<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>
          {{ $t("settings.multi_channel.add_subwoofer_title") }}
        </DialogTitle>
        <DialogDescription>
          {{
            $t("settings.multi_channel.add_subwoofer_description", [playerName])
          }}
        </DialogDescription>
      </DialogHeader>
      <form
        id="multi-channel-subwoofer-form"
        class="space-y-4"
        @submit.prevent="add"
      >
        <Select
          v-model="speakerId"
          :disabled="adding || candidates.length === 0"
        >
          <SelectTrigger
            class="w-full"
            data-testid="multi-channel-subwoofer"
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
        <p
          v-if="noSpeakers"
          data-testid="multi-channel-no-speakers"
          class="text-sm text-muted-foreground"
        >
          {{ $t("settings.multi_channel.no_speakers") }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{
            $t("settings.multi_channel.add_subwoofer_note", [
              outputName,
              playerName,
            ])
          }}
        </p>
      </form>
      <DialogFooter>
        <Button variant="outline" :disabled="adding" @click="close">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="multi-channel-subwoofer-form"
          data-testid="multi-channel-add"
          :disabled="!canAdd"
          :loading="adding"
        >
          {{ $t("add") }}
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCandidateSpeakers } from "@/composables/settings/players/useCandidateSpeakers";
import { addSubwoofer, getOutputName } from "@/helpers/player_settings_actions";
import { api } from "@/plugins/api";
import {
  eventbus,
  type MultiChannelSubwooferDialogEvent,
} from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const open = ref(false);
const adding = ref(false);
const playerId = ref("");
const playerName = ref("");
const provider = ref("");
const speakerId = ref<string>();
let onAdded: MultiChannelSubwooferDialogEvent["onAdded"];

const { candidates, noSpeakers, load } = useCandidateSpeakers(playerId);

const outputName = computed(() =>
  getOutputName({
    domain: api.getProvider(provider.value)?.domain ?? provider.value,
  }),
);

// false as well while the speaker picked went away meanwhile
const canAdd = computed(
  () =>
    !adding.value &&
    candidates.value.some(
      (candidate) => candidate.player_id === speakerId.value,
    ),
);

watch(open, (value) => {
  store.dialogActive = value;
});

const onDialogRequested = (evt: MultiChannelSubwooferDialogEvent) => {
  playerId.value = evt.playerId;
  playerName.value = evt.playerName;
  provider.value = evt.provider;
  onAdded = evt.onAdded;
  speakerId.value = undefined;
  adding.value = false;
  open.value = true;
  void load(evt.provider);
};

onMounted(() => {
  eventbus.on("multiChannelSubwooferDialog", onDialogRequested);
});

onBeforeUnmount(() => {
  // named so this drops only its own listener, not every listener for the event
  eventbus.off("multiChannelSubwooferDialog", onDialogRequested);
  if (open.value) store.dialogActive = false;
});

async function add() {
  const speaker = speakerId.value;
  if (!canAdd.value || !speaker) return;
  adding.value = true;
  try {
    // a speaker the server refuses keeps the dialog open to pick another one
    if (await addSubwoofer(playerId.value, playerName.value, speaker)) {
      close();
      onAdded?.();
    }
  } finally {
    adding.value = false;
  }
}

function setOpen(value: boolean) {
  if (!value && !adding.value) close();
}

function close() {
  open.value = false;
}
</script>
