<template>
  <!-- play/pause button: only when MA queue is active -->
  <ResponsiveIcon
    v-if="activePlayerQueue && activePlayerQueue?.active && props.isVisible"
    v-bind="props.icon"
    :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
    :icon="activePlayerQueue?.state == 'playing' ? 'mdi-pause-circle' : 'mdi-play-circle'"
    :hover="true"
    @click="api.queueCommandPlayPause(activePlayerQueue!.queue_id)"
  />
  <!-- stop button: player is playing other source (not MA)-->
  <ResponsiveIcon
    v-else-if="store.selectedPlayer?.state == PlayerState.PLAYING && props.isVisible"
    v-bind="props.icon"
    icon="mdi-stop"
    :hover="true"
    @click="api.queueCommandStop(store.selectedPlayer!.player_id)"
  />
  <!-- play button: all other situations - resume the queue (disabled if queue is empty)-->
  <ResponsiveIcon
    v-else-if="props.isVisible"
    v-bind="props.icon"
    :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
    icon="mdi-play-circle"
    :hover="true"
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
  icon?: ResponsiveIconProps;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
});

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
</script>
