<template>
  <!-- play/pause/stop button -->
  <TransportBtn
    ref="button"
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
import { useElementSize } from "@vueuse/core";
import { computed, toRef, useTemplateRef } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  size?: number;
}

const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  size: 24,
});

// the spinner ring keeps a hairline stroke at every size
const SPINNER_STROKE_WIDTH = 2;
// space between the button's edge and the spinner ring
const SPINNER_GAP = 3;
// the spinner icon draws its ring at this share of its box
const SPINNER_RING_SHARE = 0.75;

const button = useTemplateRef("button");
const { height: buttonSize } = useElementSize(button, undefined, {
  box: "border-box",
});

// the ring's middle line runs the gap plus half the stroke outside the button
const spinnerSize = computed(
  () =>
    (buttonSize.value + 2 * SPINNER_GAP + SPINNER_STROKE_WIDTH) /
    SPINNER_RING_SHARE,
);

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
