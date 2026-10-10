<template>
  <div data-testid="music-quiz-volume" class="flex min-w-0 items-center gap-1">
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="shrink-0"
      data-testid="music-quiz-mute"
      :aria-label="
        webPlayerOutput.muted ? $t('tooltip.unmute') : $t('tooltip.mute')
      "
      :aria-pressed="webPlayerOutput.muted"
      @click="webPlayerOutput.muted = !webPlayerOutput.muted"
    >
      <VolumeX v-if="isSilent" class="size-5" aria-hidden="true" />
      <Volume2 v-else class="size-5" aria-hidden="true" />
    </Button>
    <Slider
      v-if="showSlider"
      :model-value="[webPlayerOutput.volume]"
      :min="0"
      :max="100"
      :step="1"
      :thumb-label="$t('volume')"
      :thumb-value-text="`${webPlayerOutput.volume}%`"
      class="w-28"
      @update:model-value="onVolumeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DEVICE_TYPE } from "@/helpers/device";
import { $t } from "@/plugins/i18n";
import { webPlayerOutput } from "@/plugins/web_player";
import { Volume2, VolumeX } from "@lucide/vue";
import { computed } from "vue";

// Phones have hardware volume buttons, so they only get the mute toggle.
const showSlider = DEVICE_TYPE === "desktop";

const isSilent = computed(
  () => webPlayerOutput.muted || webPlayerOutput.volume === 0,
);

function onVolumeChange(value: number[] | undefined) {
  const next = value?.[0];
  if (next === undefined) return;
  webPlayerOutput.volume = next;
  webPlayerOutput.muted = false;
}
</script>
