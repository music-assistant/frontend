<template>
  <!-- play/pause button: only when MA queue is active -->
  <ResponsiveIcon
    v-if="
      store.activePlayerQueue &&
      store.activePlayerQueue?.active &&
      props.isVisible
    "
    v-bind="props.icon"
    :disabled="
      store.activePlayerQueue &&
      !store.activePlayerQueue?.active &&
      store.activePlayerQueue?.items == 0
    "
    :icon="
      store.activePlayerQueue?.state == 'playing'
        ? props.withCircle
          ? 'mdi-pause-circle'
          : 'mdi-pause'
        : props.withCircle
          ? 'mdi-play-circle'
          : 'mdi-play'
    "
    :type="'btn'"
    @click="api.queueCommandPlayPause(store.activePlayerQueue!.queue_id)"
  />
  <!-- stop button: player is playing other source (not MA)-->
  <ResponsiveIcon
    v-else-if="
      store.activePlayer?.state == PlayerState.PLAYING && props.isVisible
    "
    v-bind="props.icon"
    icon="mdi-stop"
    :type="'btn'"
    @click="api.queueCommandStop(store.activePlayer!.player_id)"
  />
  <!-- play button: all other situations - resume the queue (disabled if queue is empty)-->
  <ResponsiveIcon
    v-else-if="props.isVisible"
    v-bind="props.icon"
    :disabled="store.activePlayerQueue?.items == 0"
    :icon="props.withCircle ? 'mdi-play-circle' : 'mdi-play'"
    :type="'btn'"
    @click="
      api.queueCommandPlay(
        store.activePlayerQueue?.queue_id || store.activePlayer!.player_id,
      )
    "
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

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

const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
  withCircle: true,
  icon: undefined,
});
</script>
