<template>
  <!-- play/pause button: disabled if no content -->
  <div v-if="isVisible && player" class="play-btn-root">
    <v-progress-circular v-if="isLoading" indeterminate size="48" />
    <Icon
      v-else
      v-bind="icon"
      :disabled="!canPlayPause"
      :icon="iconStyle ? `${baseIcon}-${iconStyle}` : baseIcon"
      variant="button"
      @click="togglePlay"
    />
  </div>
</template>

<script setup lang="ts">
import Icon, { IconProps } from "@/components/Icon.vue";
import api from "@/plugins/api";
import { PlaybackState, Player, PlayerQueue } from "@/plugins/api/interfaces";
import { useActiveSource } from "@/composables/activeSource";
import { computed, toRef, ref, watch } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  isVisible?: boolean;
  withCircle?: boolean;
  icon?: IconProps;
  iconStyle?: string;
}
const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  isVisible: true,
  withCircle: true,
  icon: undefined,
  iconStyle: "circle",
});

const { activeSource } = useActiveSource(toRef(compProps, "player"));
const isLoading = ref(false);

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

const baseIcon = computed(() => {
  if (compProps.player?.playback_state == PlaybackState.PLAYING) {
    return "mdi-pause";
  }
  return "mdi-play";
});

const togglePlay = async () => {
  if (!compProps.player) return;
  isLoading.value = true;
  api.playerCommandPlayPause(compProps.player.player_id);

  // Safety timeout
  setTimeout(() => {
    isLoading.value = false;
  }, 2000);
};

watch(
  () => compProps.player?.playback_state,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      isLoading.value = false;
    }
  },
);
</script>

<style scoped>
.play-btn-root {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
</style>
