<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.multi_channel.make_title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("settings.multi_channel.make_description", [playerName]) }}
        </DialogDescription>
      </DialogHeader>
      <form
        id="multi-channel-player-form"
        class="space-y-4"
        @submit.prevent="create"
      >
        <!-- one row per channel; the swap button beside them moves this speaker -->
        <div
          class="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2"
        >
          <template v-for="(channel, index) in CHANNELS" :key="channel">
            <span class="text-sm font-medium">
              {{ $t(`settings.multi_channel.channels.${channel}`) }}
            </span>
            <div
              v-if="channel === playerChannel"
              data-testid="multi-channel-this-speaker"
              class="flex h-9 items-center truncate rounded-md border bg-muted/40 px-3 text-sm"
            >
              {{ $t("settings.multi_channel.this_speaker", [playerName]) }}
            </div>
            <Select
              v-else
              v-model="speakerId"
              :disabled="creating || candidates.length === 0"
            >
              <SelectTrigger
                class="w-full"
                data-testid="multi-channel-speaker"
                :aria-label="$t('settings.multi_channel.pick_speaker')"
              >
                <SelectValue
                  :placeholder="$t('settings.multi_channel.pick_speaker')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="candidate in candidates"
                  :key="candidate.player_id"
                  :value="candidate.player_id"
                >
                  {{ candidate.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              v-if="index === 0"
              type="button"
              variant="ghost"
              size="icon"
              class="row-span-2"
              data-testid="multi-channel-swap"
              :disabled="creating"
              :aria-label="$t('settings.multi_channel.swap')"
              :title="$t('settings.multi_channel.swap')"
              @click="swapChannels"
            >
              <ArrowUpDown class="size-4" />
            </Button>
          </template>
        </div>
        <p
          v-if="noSpeakers"
          data-testid="multi-channel-no-speakers"
          class="text-sm text-muted-foreground"
        >
          {{ $t("settings.multi_channel.no_speakers") }}
        </p>
        <div class="space-y-2">
          <Label for="multi-channel-name">
            {{ $t("settings.multi_channel.name") }}
          </Label>
          <Input
            id="multi-channel-name"
            :model-value="name"
            :disabled="creating"
            autocomplete="off"
            @update:model-value="setName"
          />
        </div>
        <p class="text-sm text-muted-foreground">
          {{ $t("settings.multi_channel.make_note", [outputName]) }}
        </p>
      </form>
      <DialogFooter>
        <Button variant="outline" :disabled="creating" @click="close">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="multi-channel-player-form"
          data-testid="multi-channel-create"
          :disabled="!canCreate"
          :loading="creating"
        >
          {{ $t("create") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { suggestMultiChannelName } from "@/helpers/multi_channel";
import {
  createMultiChannelPlayer,
  getOutputName,
} from "@/helpers/player_settings_actions";
import { getPlayerDisplayName } from "@/helpers/players";
import { api } from "@/plugins/api";
import {
  type PlayerProtocolInfo,
  SpeakerChannel,
} from "@/plugins/api/interfaces";
import {
  eventbus,
  type MultiChannelPlayerDialogEvent,
} from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { ArrowUpDown } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

// the channels of a stereo pair, in the order the rows show them
const CHANNELS = [SpeakerChannel.FRONT_LEFT, SpeakerChannel.FRONT_RIGHT];

const open = ref(false);
const creating = ref(false);
const playerId = ref("");
const playerName = ref("");
const protocol = ref<PlayerProtocolInfo>();
// the channel of the speaker the dialog opened for; the other speaker takes the other one
const playerChannel = ref(SpeakerChannel.FRONT_LEFT);
const speakerId = ref<string>();
const name = ref("");
// a name the user typed is theirs; until then it follows the speakers picked
const nameEdited = ref(false);
// the players the server lists as candidate speakers; undefined while they load
const candidateIds = ref<string[]>();
let candidatesRequestId = 0;
let onCreated: MultiChannelPlayerDialogEvent["onCreated"];

const candidates = computed(() =>
  (candidateIds.value ?? [])
    .filter((id) => id !== playerId.value)
    .flatMap((id) => {
      const player = api.players[id];
      return player
        ? [{ player_id: id, name: getPlayerDisplayName(player) }]
        : [];
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    ),
);

const noSpeakers = computed(
  () => candidateIds.value !== undefined && candidates.value.length === 0,
);

// undefined as well when the speaker picked went away meanwhile
const speakerName = computed(
  () =>
    candidates.value.find(
      (candidate) => candidate.player_id === speakerId.value,
    )?.name,
);

const outputName = computed(() =>
  protocol.value ? getOutputName(protocol.value) : "",
);

const canCreate = computed(
  () => !!speakerName.value && !!name.value.trim() && !creating.value,
);

watch(open, (value) => {
  store.dialogActive = value;
});

watch(speakerName, (value) => {
  if (value && !nameEdited.value) {
    name.value = suggestMultiChannelName(playerName.value, value);
  }
});

const onDialogRequested = (evt: MultiChannelPlayerDialogEvent) => {
  playerId.value = evt.playerId;
  playerName.value = evt.playerName;
  protocol.value = evt.protocol;
  onCreated = evt.onCreated;
  playerChannel.value = SpeakerChannel.FRONT_LEFT;
  speakerId.value = undefined;
  name.value = "";
  nameEdited.value = false;
  creating.value = false;
  candidateIds.value = undefined;
  open.value = true;
  void loadCandidates(evt.protocol.provider);
};

onMounted(() => {
  eventbus.on("multiChannelPlayerDialog", onDialogRequested);
});

onBeforeUnmount(() => {
  // named so this drops only its own listener, not every listener for the event
  eventbus.off("multiChannelPlayerDialog", onDialogRequested);
  if (open.value) store.dialogActive = false;
});

async function loadCandidates(provider: string) {
  const request = ++candidatesRequestId;
  let ids: string[];
  try {
    ids = await api.getMultiChannelCandidates(provider);
  } catch {
    // a failed command is already reported by the api layer
    ids = [];
  }
  // a dialog opened again meanwhile asked for the speakers of another player
  if (request === candidatesRequestId) candidateIds.value = ids;
}

function swapChannels() {
  playerChannel.value = otherChannel(playerChannel.value);
}

function setName(value: string | number) {
  name.value = String(value);
  nameEdited.value = true;
}

function otherChannel(channel: SpeakerChannel): SpeakerChannel {
  return CHANNELS.find((candidate) => candidate !== channel) ?? channel;
}

async function create() {
  const speaker = speakerId.value;
  if (!canCreate.value || !speaker || !protocol.value) return;
  creating.value = true;
  try {
    const player = await createMultiChannelPlayer(
      protocol.value.provider,
      name.value.trim(),
      {
        [playerId.value]: playerChannel.value,
        [speaker]: otherChannel(playerChannel.value),
      },
    );
    // a player the server refuses keeps the dialog open to change the choice
    if (player) {
      close();
      onCreated?.(player.player_id);
    }
  } finally {
    creating.value = false;
  }
}

function setOpen(value: boolean) {
  if (!value && !creating.value) close();
}

function close() {
  open.value = false;
}
</script>
