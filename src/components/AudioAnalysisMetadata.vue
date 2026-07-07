<template>
  <!-- audio analysis details (bpm / musical key), only present on full track details -->
  <Popover v-if="bpm || musicalKey">
    <PopoverTrigger as-child>
      <AudioWaveform
        :size="26"
        class="cursor-pointer"
        :title="$t('audio_analysis')"
      />
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="center"
      :collision-padding="12"
      class="audio-analysis-popover overflow-y-auto p-3"
      :style="{
        width: 'fit-content',
        minWidth: '180px',
        maxWidth: 'calc(100vw - 25px)',
      }"
      @open-auto-focus.prevent
    >
      <div class="font-medium audio-analysis-item">
        {{ $t("audio_analysis") }}
      </div>
      <div v-if="bpm" class="audio-analysis-item">
        <v-icon size="20" color="primary" icon="mdi-metronome" />
        <span :title="$t('tooltip.bpm')">{{ bpm }} {{ $t("bpm") }}</span>
      </div>
      <div v-if="musicalKey" class="audio-analysis-item">
        <v-icon size="20" color="primary" icon="mdi-music-clef-treble" />
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
import { computed } from "vue";

const props = defineProps<{
  audioMetadata?: AudioMetadata | null;
}>();

const bpm = computed(() =>
  props.audioMetadata?.bpm ? Math.round(props.audioMetadata.bpm) : undefined,
);
const musicalKey = computed(
  () => props.audioMetadata?.musical_key || undefined,
);
</script>

<style>
.audio-analysis-popover {
  /* match the streamdetails (quality) popover typography and row rhythm */
  font-size: 0.875rem;
}

.audio-analysis-item {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
