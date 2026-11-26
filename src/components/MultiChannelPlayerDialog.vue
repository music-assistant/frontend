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
        <!-- a single layout is no choice -->
        <FieldSet v-if="layoutChoices.length > 1" class="gap-3">
          <FieldLegend variant="label" class="mb-0">
            {{ $t("settings.multi_channel.layout") }}
          </FieldLegend>
          <RadioGroup
            :model-value="layout"
            :disabled="creating"
            class="gap-2"
            @update:model-value="setLayout($event as ChannelLayout)"
          >
            <Field
              v-for="option in layoutChoices"
              :key="option"
              orientation="horizontal"
            >
              <RadioGroupItem
                :id="`multi-channel-layout-${option}`"
                :value="option"
              />
              <FieldLabel
                :for="`multi-channel-layout-${option}`"
                class="font-normal"
              >
                {{ getChannelLayoutLabel(option) }}
              </FieldLabel>
            </Field>
          </RadioGroup>
        </FieldSet>
        <!-- one row per channel; the swap button beside the first two swaps their speakers -->
        <div
          data-testid="multi-channel-channels"
          class="grid grid-cols-[minmax(4rem,auto)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2"
        >
          <template v-for="(channel, index) in channels" :key="channel">
            <span class="text-sm font-medium">
              {{ $t(`settings.multi_channel.channels.${channel}`) }}
            </span>
            <div
              v-if="speakers[channel] === playerId"
              data-testid="multi-channel-this-speaker"
              class="flex h-9 items-center truncate rounded-md border bg-muted/40 px-3 text-sm"
            >
              {{ $t("settings.multi_channel.this_speaker", [playerName]) }}
            </div>
            <Select
              v-else
              :model-value="speakers[channel]"
              :disabled="creating || candidates.length === 0"
              @update:model-value="pickSpeaker(channel, $event)"
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
                <!-- picking this speaker moves it to the row -->
                <SelectItem :value="playerId">
                  {{ $t("settings.multi_channel.this_speaker", [playerName]) }}
                </SelectItem>
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
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCandidateSpeakers } from "@/composables/settings/players/useCandidateSpeakers";
import {
  assignChannelSpeaker,
  changeChannelLayout,
  type ChannelSpeakers,
  type MultiChannelLayouts,
  suggestMultiChannelName,
} from "@/helpers/multi_channel";
import {
  createMultiChannelPlayer,
  getOutputName,
} from "@/helpers/player_settings_actions";
import { getChannelLayoutLabel } from "@/helpers/players";
import {
  type ChannelLayout,
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

const open = ref(false);
const creating = ref(false);
const playerId = ref("");
const playerName = ref("");
const protocol = ref<PlayerProtocolInfo>();
// the layouts the server offers, in its order, and the one picked
const layouts = ref<MultiChannelLayouts>({});
const layout = ref<ChannelLayout>();
// the speaker on each channel; the one the dialog opened for always has one
const speakers = ref<ChannelSpeakers>({});
const name = ref("");
// a name the user typed is theirs; until then it follows the speakers picked
const nameEdited = ref(false);
let onCreated: MultiChannelPlayerDialogEvent["onCreated"];

const { candidates, noSpeakers, load } = useCandidateSpeakers(playerId);

const layoutChoices = computed(
  () => Object.keys(layouts.value) as ChannelLayout[],
);

const channels = computed(() =>
  layout.value ? (layouts.value[layout.value] ?? []) : [],
);

// the speaker on each channel by the player id, once every channel has one that can join
const members = computed(() => {
  if (channels.value.length === 0) return undefined;
  const result: Record<string, SpeakerChannel> = {};
  for (const channel of channels.value) {
    const speaker = speakers.value[channel];
    if (!speaker || getSpeakerName(speaker) === undefined) return undefined;
    result[speaker] = channel;
  }
  return result;
});

// the speakers that play the music name the player, once they are all picked
const suggestedName = computed(() => {
  const names = channels.value
    .filter((channel) => channel !== SpeakerChannel.LFE)
    .map((channel) => getSpeakerName(speakers.value[channel]));
  return names.every((value) => value !== undefined)
    ? suggestMultiChannelName(...(names as string[]))
    : undefined;
});

const outputName = computed(() =>
  protocol.value ? getOutputName(protocol.value) : "",
);

const canCreate = computed(
  () => !!members.value && !!name.value.trim() && !creating.value,
);

watch(open, (value) => {
  store.dialogActive = value;
});

watch(suggestedName, (value) => {
  if (value !== undefined && !nameEdited.value) name.value = value;
});

const onDialogRequested = (evt: MultiChannelPlayerDialogEvent) => {
  playerId.value = evt.playerId;
  playerName.value = evt.playerName;
  protocol.value = evt.protocol;
  onCreated = evt.onCreated;
  layouts.value = evt.layouts;
  // the dialog opens on the first layout, with this speaker on its first channel
  layout.value = layoutChoices.value[0];
  speakers.value = changeChannelLayout({}, channels.value, evt.playerId);
  name.value = "";
  nameEdited.value = false;
  creating.value = false;
  open.value = true;
  void load(evt.protocol.provider);
};

onMounted(() => {
  eventbus.on("multiChannelPlayerDialog", onDialogRequested);
});

onBeforeUnmount(() => {
  // named so this drops only its own listener, not every listener for the event
  eventbus.off("multiChannelPlayerDialog", onDialogRequested);
  if (open.value) store.dialogActive = false;
});

// undefined as well for a speaker that went away after it was picked
function getSpeakerName(speaker: string | undefined): string | undefined {
  if (speaker === playerId.value) return playerName.value;
  return candidates.value.find((candidate) => candidate.player_id === speaker)
    ?.name;
}

function setLayout(value: ChannelLayout) {
  layout.value = value;
  speakers.value = changeChannelLayout(
    speakers.value,
    channels.value,
    playerId.value,
  );
}

function pickSpeaker(channel: SpeakerChannel, speaker: unknown) {
  if (typeof speaker !== "string") return;
  speakers.value = assignChannelSpeaker(speakers.value, channel, speaker);
}

function swapChannels() {
  const [first, second] = channels.value;
  speakers.value = {
    ...speakers.value,
    [first]: speakers.value[second],
    [second]: speakers.value[first],
  };
}

function setName(value: string | number) {
  name.value = String(value);
  nameEdited.value = true;
}

async function create() {
  if (!canCreate.value || !members.value || !protocol.value) return;
  creating.value = true;
  try {
    const player = await createMultiChannelPlayer(
      protocol.value.provider,
      name.value.trim(),
      members.value,
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
