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
      class="w-auto min-w-[210px] p-3"
      @open-auto-focus.prevent
    >
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <AudioWaveform :size="18" />
          <span class="text-[0.95rem] font-semibold">
            {{ $t("audio_analysis") }}
          </span>
        </div>

        <div class="grid auto-cols-fr grid-flow-col gap-2">
          <div
            v-if="bpm"
            class="bg-accent/50 rounded-md px-3 py-2 text-center"
            :title="$t('tooltip.bpm')"
          >
            <div class="text-base font-semibold tabular-nums">{{ bpm }}</div>
            <div class="text-muted-foreground text-xs">{{ $t("bpm") }}</div>
          </div>
          <div
            v-if="musicalKey"
            class="bg-accent/50 rounded-md px-3 py-2 text-center"
            :title="$t('tooltip.musical_key')"
          >
            <div class="text-base font-semibold">{{ musicalKey }}</div>
            <div class="text-muted-foreground text-xs">
              {{ $t("musical_key") }}
            </div>
          </div>
        </div>
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
