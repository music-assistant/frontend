<template>
  <!-- audio analysis details (bpm / musical key), only present on full track details -->
  <Popover v-if="bpm || musicalKey" v-model:open="open">
    <PopoverTrigger as-child>
      <AudioWaveform
        :size="24"
        class="cursor-pointer"
        :title="$t('audio_analysis')"
        @mouseenter="scheduleOpen"
        @mouseleave="scheduleClose"
        @click="open = !open"
      />
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="center"
      :collision-padding="12"
      class="w-fit p-3"
      @open-auto-focus.prevent
      @mouseenter="scheduleOpen"
      @mouseleave="scheduleClose"
    >
      <div class="text-sm font-medium pb-1">{{ $t("audio_analysis") }}</div>
      <div v-if="bpm" class="d-flex align-center ga-2 text-sm">
        <v-icon size="18" color="primary" icon="mdi-metronome" />
        <span :title="$t('tooltip.bpm')">{{ bpm }} {{ $t("bpm") }}</span>
      </div>
      <div v-if="musicalKey" class="d-flex align-center ga-2 text-sm">
        <v-icon size="18" color="primary" icon="mdi-music-clef-treble" />
        <span :title="$t('tooltip.musical_key')">{{ musicalKey }}</span>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AudioMetadata } from "@/plugins/api/interfaces";
import { AudioWaveform } from "@lucide/vue";
import { computed, ref } from "vue";

const props = defineProps<{
  audioMetadata?: AudioMetadata | null;
}>();

const open = ref(false);
let closeTimer: ReturnType<typeof setTimeout> | undefined;

const bpm = computed(() =>
  props.audioMetadata?.bpm ? Math.round(props.audioMetadata.bpm) : undefined,
);
const musicalKey = computed(
  () => props.audioMetadata?.musical_key || undefined,
);

// hover opens on desktop; the small close delay keeps the popover alive while
// the pointer travels from trigger to content. Click/tap still toggles (mobile).
const scheduleOpen = function () {
  clearTimeout(closeTimer);
  open.value = true;
};

const scheduleClose = function () {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => (open.value = false), 150);
};
</script>
