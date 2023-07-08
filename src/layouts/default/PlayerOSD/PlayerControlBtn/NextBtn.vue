<template>
  <!-- next button -->
  <ResponsiveIcon
    v-if="props.isVisible"
    v-bind="props.icon"
    :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
    icon="mdi-skip-next-outline"
    :hover="true"
    @click="api.queueCommandNext(activePlayerQueue!.queue_id)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
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
