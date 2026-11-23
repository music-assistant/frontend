<template>
  <!-- play/pause/stop button -->
  <TransportBtn
    class="relative rounded-full bg-[#212121] text-[var(--play-icon-color,#fff)] dark:bg-white dark:text-[var(--play-icon-color,#212121)]"
    v-bind="$attrs"
    :icon-size="size"
    :disabled="isDisabled"
    :label="playButtonLabel"
    @click="playPause"
  >
    <Square
      v-if="isPlaying && showStop"
      :size="size"
      fill="currentColor"
      stroke-width="0"
    />
    <Pause v-else-if="isPlaying" :size="size" fill="currentColor" />
    <Play v-else :size="size" fill="currentColor" class="play-icon-centered" />
  </TransportBtn>
  <Spinner
    v-if="player && isLoading"
    class="pointer-events-none absolute top-1/2 left-1/2 z-1 size-(--spinner-size) -translate-1/2"
    :style="{ '--spinner-size': `${spinnerSize}px` }"
    :size="spinnerSize"
    :stroke-width="SPINNER_STROKE_WIDTH"
    absolute-stroke-width
  />
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
defineOptions({ inheritAttrs: false });
import { Spinner } from "@/components/ui/spinner";
import { usePlayPauseCommand } from "@/composables/usePlayPauseCommand";
import TransportBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/TransportBtn.vue";
import { Player, PlayerQueue } from "@/plugins/api/interfaces";
import { Pause, Play, Square } from "@lucide/vue";
import { computed, toRef } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  spinnerSize?: number;
  size?: number;
}

const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  spinnerSize: 46,
  size: 24,
});

// the spinner ring keeps a hairline stroke at every size
const SPINNER_STROKE_WIDTH = 2;

const { isPlaying, showStop, isLoading, isDisabled, playPause } =
  usePlayPauseCommand(
    toRef(compProps, "player"),
    toRef(compProps, "playerQueue"),
  );

const playButtonLabel = computed(() => {
  if (isPlaying.value && showStop.value) return $t("stop_playback");
  return isPlaying.value ? $t("pause") : $t("play");
});
</script>
