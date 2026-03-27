<template>
  <!-- play/pause button: disabled if no content -->
  <Icon
    v-if="isVisible && player"
    v-bind="{ ...icon, ...$attrs }"
    class="play-btn-icon"
    :disabled="!canPlayPause || isLoading"
    variant="button"
    @click="api.playerCommandPlayPause(player.player_id)"
  >
    <Pause v-if="isPlaying" :size="size" fill="currentColor" />
    <Play
      v-else
      :size="size"
      fill="currentColor"
      :style="{ marginLeft: `${compProps.playOffset}px` }"
    />
  </Icon>
  <Spinner
    v-if="isVisible && player && isLoading"
    class="play-btn-spinner"
    :size="compProps.spinnerSize"
  />
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { Spinner } from "@/components/ui/spinner";
import { useActiveSource } from "@/composables/activeSource";
import api from "@/plugins/api";
import { PlaybackState, Player, PlayerQueue } from "@/plugins/api/interfaces";
import { Pause, Play } from "lucide-vue-next";
import { computed, toRef } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  isVisible?: boolean;
  icon?: IconProps;
  spinnerSize?: number;
  size?: number;
  playOffset?: number;
}

const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  isVisible: true,
  icon: undefined,
  spinnerSize: 46,
  size: 24,
  playOffset: 1,
});

const { activeSource } = useActiveSource(toRef(compProps, "player"));

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
  // Check if active source can play/pause
  if (activeSource.value) {
    return activeSource.value.can_play_pause;
  }
  // Fall back to queue or player capabilities
  return queueCanPlay.value || playerCanPlay.value;
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
</script>

<style>
.play-btn-icon {
  position: relative;
  border-radius: 50%;
  background-color: var(--foreground);
  color: var(--play-icon-color, var(--background));
  opacity: 1 !important;
}

.play-btn-icon:hover {
  opacity: 0.85 !important;
}

.play-btn-spinner {
  position: absolute;
  inset: 0;
  margin: auto;
  pointer-events: none;
  z-index: 1;
}
</style>
