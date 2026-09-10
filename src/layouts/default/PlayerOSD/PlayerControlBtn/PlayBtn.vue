<template>
  <!-- play/pause/stop button -->
  <Icon
    v-bind="{ ...icon, ...$attrs }"
    class="play-btn-icon"
    :disabled="isDisabled"
    :aria-label="playButtonLabel"
    :title="playButtonLabel"
    variant="button"
    @click="playPause"
  >
    <Square
      v-if="isPlaying && showStop"
      :size="size"
      fill="currentColor"
      stroke-width="0"
    />
    <Pause v-else-if="isPlaying" :size="size" fill="currentColor" />
    <Play
      v-else
      :size="size"
      fill="currentColor"
      :style="{ marginLeft: `${compProps.playOffset}px` }"
    />
  </Icon>
  <v-progress-circular
    v-if="player && isLoading"
    class="play-btn-spinner"
    indeterminate
    :size="compProps.spinnerSize"
    :width="2"
  />
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { usePlayPauseCommand } from "@/composables/usePlayPauseCommand";
import { Player, PlayerQueue } from "@/plugins/api/interfaces";
import { Pause, Play, Square } from "@lucide/vue";
import { computed, toRef } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  icon?: IconProps;
  spinnerSize?: number;
  size?: number;
  playOffset?: number;
}

const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  icon: undefined,
  spinnerSize: 46,
  size: 24,
  playOffset: 1,
});

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

<style>
.play-btn-icon {
  position: relative;
  border-radius: 50%;
  background-color: #212121;
  color: var(--play-icon-color, #fff);
}

.v-theme--dark .play-btn-icon {
  background-color: #fff;
  color: var(--play-icon-color, #212121);
}

.play-btn-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
}
</style>
