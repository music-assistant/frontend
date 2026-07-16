<!--
  Global dialog to configure a queue's audio overlay: pick a looping sound
  effect (rain, white noise, ...), toggle it on/off and set how loud it is
  relative to the music. Opened from the player overflow menu and the
  fullscreen "overlay active" pill via the centralized eventbus.
-->
<template>
  <Dialog :key="dialogKey" v-model:open="showDialog">
    <DialogContent class="sm:max-w-[460px]">
      <DialogHeader>
        <DialogTitle class="mb-1">{{ $t("audio_overlay") }}</DialogTitle>
        <DialogDescription>
          {{ $t("audio_overlay_explanation") }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="loading && !soundEffects.length"
        class="flex justify-center py-8"
      >
        <Spinner />
      </div>

      <div
        v-else-if="!soundEffects.length"
        class="py-6 text-center text-sm text-muted-foreground"
      >
        {{ $t("audio_overlay_no_sounds") }}
      </div>

      <div v-else class="flex flex-col gap-5 py-1">
        <!-- sound selection -->
        <div class="flex flex-col gap-2">
          <Label for="overlay-sound">{{ $t("audio_overlay_sound") }}</Label>
          <Select
            :model-value="selectedSource"
            @update:model-value="
              (val: unknown) => onSelectSource(val as string)
            "
          >
            <SelectTrigger id="overlay-sound" class="w-full">
              <SelectValue :placeholder="$t('audio_overlay_select_sound')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="effect in soundEffects"
                :key="effect.uri"
                :value="effect.uri"
              >
                {{ effect.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- enable toggle (needs a selected sound before it can be turned on) -->
        <div class="flex items-center justify-between gap-4">
          <Label for="overlay-enabled" class="cursor-pointer">
            {{ $t("audio_overlay_enable") }}
          </Label>
          <Switch
            id="overlay-enabled"
            :model-value="enabled"
            :disabled="!selectedSource"
            @update:model-value="onToggleEnabled"
          />
        </div>

        <!-- volume relative to the music (100% = equally loud) -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>{{ $t("audio_overlay_volume") }}</Label>
            <span class="text-sm text-muted-foreground">{{ volume }}%</span>
          </div>
          <Slider
            :model-value="[volume]"
            :min="0"
            :max="200"
            :step="5"
            @update:model-value="onVolumeInput"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useAudioOverlay } from "@/composables/useAudioOverlay";
import api from "@/plugins/api";
import { type AudioOverlayDialogEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

const VOLUME_DEBOUNCE_MS = 300;

const { soundEffects, loading, loadSoundEffects } = useAudioOverlay();

const showDialog = ref(false);
// force Dialog remount via dynamic key to prevent the enter animation from
// stalling at opacity:0 when opened from a context menu
const dialogKey = ref(0);
const queueId = ref("");
const volume = ref(100);
// pending debounced volume commit; while set, incoming server values don't
// snap the slider back under the user's finger
let volumeTimer: ReturnType<typeof setTimeout> | null = null;

const queue = computed(() =>
  queueId.value ? api.queues[queueId.value] : undefined,
);
const enabled = computed(() => queue.value?.overlay_enabled ?? false);
const selectedSource = computed(() => queue.value?.overlay_source?.uri ?? "");

watch(
  () => queue.value?.overlay_volume,
  (val) => {
    if (val !== undefined && volumeTimer === null) volume.value = val;
  },
);

watch(showDialog, (open) => {
  store.dialogActive = open;
});

onMounted(() => {
  eventbus.on("audioOverlayDialog", (evt: AudioOverlayDialogEvent) => {
    queueId.value = evt.queueId;
    volume.value = queue.value?.overlay_volume ?? 100;
    loadSoundEffects();
    dialogKey.value++;
    showDialog.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("audioOverlayDialog");
});

const onSelectSource = (uri: string) => {
  if (!queueId.value || !uri) return;
  api.queueCommandOverlay(queueId.value, { source: uri });
};

const onToggleEnabled = (value: boolean) => {
  if (!queueId.value) return;
  api.queueCommandOverlay(queueId.value, { enabled: value });
};

const onVolumeInput = (values: number[] | undefined) => {
  if (!values || !queueId.value) return;
  volume.value = values[0];
  // capture the target queue and value now so a late-firing commit always
  // applies to the interaction that scheduled it, even if the dialog is
  // meanwhile reopened for a different queue
  const targetQueueId = queueId.value;
  const targetVolume = values[0];
  if (volumeTimer) clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => {
    api.queueCommandOverlay(targetQueueId, { volume: targetVolume });
    volumeTimer = null;
  }, VOLUME_DEBOUNCE_MS);
};
</script>
