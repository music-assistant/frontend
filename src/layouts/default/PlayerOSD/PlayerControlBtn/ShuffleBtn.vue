<template>
  <!-- shuffle button -->
  <ResponsiveIcon
    v-if="props.isVisible"
    v-bind="props.icon"
    :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
    :color="getValueFromSources(props.icon?.color, [[activePlayerQueue?.shuffle_enabled, 'secondary', '']])"
    :icon="
      getValueFromSources(props.icon?.icon, [
        [activePlayerQueue?.shuffle_enabled, 'mdi-shuffle'],
        [activePlayerQueue?.shuffle_enabled == false, 'mdi-shuffle-disabled'],
        [true, 'mdi-shuffle'],
      ])
    "
    :type="'btn'"
    @click="
      api.queueCommandShuffle(activePlayerQueue?.queue_id || '', activePlayerQueue?.shuffle_enabled ? false : true)
    "
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { store } from '@/plugins/store';
import ResponsiveIcon, { ResponsiveIconProps } from '@/components/mods/ResponsiveIcon.vue';
import { getValueFromSources } from '@/helpers/utils';

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