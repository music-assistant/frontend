<template>
  <!-- play/pause button: only when MA queue is active -->
  <ResponsiveIcon
    v-if="activePlayerQueue && activePlayerQueue?.active && props.isVisible"
    v-bind="props.icon"
    :disabled="activePlayerQueue && !activePlayerQueue?.active && activePlayerQueue?.items == 0"
    :icon="
      activePlayerQueue?.state == 'playing'
        ? withCircle
          ? 'mdi-pause-circle'
          : 'mdi-pause'
        : withCircle
        ? 'mdi-play-circle'
        : 'mdi-play'
    "
    :type="'btn'"
    @click="api.queueCommandPlayPause(activePlayerQueue!.queue_id)"
  />
  <!-- stop button: player is playing other source (not MA)-->
  <ResponsiveIcon
    v-else-if="store.selectedPlayer?.state == PlayerState.PLAYING && props.isVisible"
    v-bind="props.icon"
    icon="mdi-stop"
    :type="'btn'"
    @click="api.queueCommandStop(store.selectedPlayer!.player_id)"
  />
  <!-- play button: all other situations - resume the queue (disabled if queue is empty)-->
  <ResponsiveIcon
    v-else-if="props.isVisible"
    v-bind="props.icon"
    :disabled="!activePlayerQueue || activePlayerQueue?.items == 0"
    :icon="withCircle ? 'mdi-play-circle' : 'mdi-play'"
    :type="'btn'"
    @click="api.queueCommandPlay(activePlayerQueue?.queue_id || store.selectedPlayer!.player_id)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { PlayerState } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import ResponsiveIcon, { ResponsiveIconProps } from '@/components/mods/ResponsiveIcon.vue';

// properties
export interface Props {
  isVisible?: boolean;
  withCircle?: boolean;
  icon?: ResponsiveIconProps;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
  withCircle: true,
});

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
</script>
