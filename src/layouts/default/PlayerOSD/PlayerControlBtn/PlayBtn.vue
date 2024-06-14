<template>
  <!-- play/pause button: only when MA queue is active -->
  <ResponsiveIcon
    v-if="isVisible && store.activePlayerQueue?.active"
    v-bind="icon"
    :disabled="store.activePlayerQueue.items == 0"
    :icon="
      store.activePlayerQueue?.state == 'playing'
        ? withCircle
          ? 'mdi-pause-circle'
          : 'mdi-pause'
        : withCircle
          ? 'mdi-play-circle'
          : 'mdi-play'
    "
    :type="'btn'"
    @clicked="api.queueCommandPlayPause(store.activePlayerQueue!.queue_id)"
  />
  <!-- stop button: player is playing other source (not MA)-->
  <ResponsiveIcon
    v-else-if="isVisible && store.activePlayer?.state == PlayerState.PLAYING"
    v-bind="icon"
    icon="mdi-stop"
    :type="'btn'"
    @click="api.queueCommandStop(store.activePlayer!.player_id)"
  />
  <!-- play button: all other situations-->
  <ResponsiveIcon
    v-else-if="isVisible"
    v-bind="icon"
    :disabled="!store.activePlayerId || !store.activePlayer?.active_source"
    :icon="withCircle ? 'mdi-play-circle' : 'mdi-play'"
    :type="'btn'"
    @clicked="api.playerCommandPlay(store.activePlayerId!)"
  />
</template>

<script setup lang="ts">
import api from '@/plugins/api';
import { PlayerState } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import ResponsiveIcon, {
  ResponsiveIconProps,
} from '@/components/mods/ResponsiveIcon.vue';

// properties
export interface Props {
  isVisible?: boolean;
  withCircle?: boolean;
  icon?: ResponsiveIconProps;
}
withDefaults(defineProps<Props>(), {
  isVisible: true,
  withCircle: true,
  icon: undefined,
});
</script>
