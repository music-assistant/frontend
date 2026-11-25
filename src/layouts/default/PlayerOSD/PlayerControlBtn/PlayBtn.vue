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
  <!-- starts with part of its tail, draws the rest, pulls it in on exit -->
  <Transition
    enter-active-class="[transition:opacity_120ms_linear,--comet-reveal_650ms_linear]"
    enter-from-class="opacity-0 [--comet-reveal:0.35] motion-reduce:[--comet-reveal:1]"
    leave-active-class="[transition:--comet-reveal_250ms_ease-in,opacity_150ms_ease-in_200ms]"
    leave-to-class="opacity-0 [--comet-reveal:0] motion-reduce:[--comet-reveal:1]"
  >
    <CometSpinner
      v-if="showSpinner"
      class="pointer-events-none absolute top-1/2 left-1/2 z-1 size-(--spinner-size) -translate-1/2"
      :style="{ '--spinner-size': `${spinnerSize}px` }"
      :stroke-width="SPINNER_STROKE_WIDTH"
    />
  </Transition>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
defineOptions({ inheritAttrs: false });
import { CometSpinner } from "@/components/ui/spinner";
import { usePlayPauseCommand } from "@/composables/usePlayPauseCommand";
import TransportBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/TransportBtn.vue";
import { Player, PlayerQueue } from "@/plugins/api/interfaces";
import { Pause, Play, Square } from "@lucide/vue";
import { useElementSize, useTimeoutFn } from "@vueuse/core";
import { computed, ref, toRef, useTemplateRef, watch } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  size?: number;
  /** space in px between the button's edge and the loading ring */
  spinnerGap?: number;
}

const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  size: 24,
  spinnerGap: 3,
});

// the spinner ring keeps a hairline stroke at every size
const SPINNER_STROKE_WIDTH = 2;
// a load quicker than this never shows the spinner
const SPINNER_SHOW_DELAY_MS = 150;

const button = useTemplateRef("button");
const { height: buttonSize } = useElementSize(button, undefined, {
  box: "border-box",
});

// the ring's outer edge runs the gap plus the stroke outside the button
const spinnerSize = computed(
  () => buttonSize.value + 2 * (compProps.spinnerGap + SPINNER_STROKE_WIDTH),
);

const { isPlaying, showStop, isLoading, isDisabled, playPause } =
  usePlayPauseCommand(
    toRef(compProps, "player"),
    toRef(compProps, "playerQueue"),
  );

// shows once loading has lasted the delay, hides straight away
const showSpinner = ref(false);
const spinnerTimer = useTimeoutFn(
  () => (showSpinner.value = true),
  SPINNER_SHOW_DELAY_MS,
  { immediate: false },
);
watch(
  () => !!compProps.player && isLoading.value,
  (loading) => {
    if (loading) return spinnerTimer.start();
    spinnerTimer.stop();
    showSpinner.value = false;
  },
  { immediate: true },
);

const playButtonLabel = computed(() => {
  if (isPlaying.value && showStop.value) return $t("stop_playback");
  return isPlaying.value ? $t("pause") : $t("play");
});
</script>
