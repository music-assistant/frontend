<template>
  <!-- play/pause/stop button -->
  <Icon
    v-bind="{ ...icon, ...$attrs }"
    class="play-btn-icon"
    :disabled="!player || isLoading || isDisabled"
    variant="button"
    @click="onClick"
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
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { useActiveAudioSource } from "@/composables/activeAudioSource";
import { useActiveSource } from "@/composables/activeSource";
import api from "@/plugins/api";
import {
  MediaType,
  PlaybackState,
  Player,
  PlayerQueue,
} from "@/plugins/api/interfaces";
import { Pause, Play, Square } from "lucide-vue-next";
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

const { activeSource } = useActiveSource(toRef(compProps, "player"));
const { activeAudioSource } = useActiveAudioSource(toRef(compProps, "player"));

const queueCanPlay = computed(() => {
  if (!compProps.playerQueue) return false;
  return compProps.playerQueue.items > 0;
});

const playerCanPlay = computed(() => {
  if (!compProps.player) return false;
  if (compProps.playerQueue?.active) return false;
  if (!compProps.player.current_media) return false;
  return true;
});

const canPlayPause = computed(() => {
  // AudioSource queue items carry their own capability flags
  if (activeAudioSource.value) {
    return activeAudioSource.value.can_play_pause;
  }
  // Check if active source can play/pause
  if (activeSource.value) {
    return activeSource.value.can_play_pause;
  }
  // Fall back to queue or player capabilities
  return queueCanPlay.value || playerCanPlay.value;
});

// When the current media can't be paused, surface Stop while playing so the
// user always has a way to terminate playback. Covers AudioSources without
// pause support, external sources that don't advertise it, and radio streams.
const showStop = computed(() => {
  if (activeAudioSource.value) return !activeAudioSource.value.can_play_pause;
  if (compProps.player?.current_media?.media_type === MediaType.RADIO)
    return true;
  if (activeSource.value) return !activeSource.value.can_play_pause;
  return false;
});

const isPlaying = computed(() => {
  return compProps.player?.playback_state == PlaybackState.PLAYING;
});

const isLoading = computed(() => {
  if (!compProps.player) return false;
  return (
    compProps.playerQueue?.extra_attributes?.play_action_in_progress === true
  );
});

const isDisabled = computed(() => {
  if (isLoading.value) return true;
  // Stop is always available while playing, even when pause isn't supported
  if (isPlaying.value && showStop.value) return false;
  return !canPlayPause.value;
});

const onClick = () => {
  if (!compProps.player) return;
  if (isPlaying.value && showStop.value) {
    api.playerCommandStop(compProps.player.player_id);
  } else {
    api.playerCommandPlayPause(compProps.player.player_id);
  }
};
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
