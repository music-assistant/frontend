<template>
  <!-- repeat button -->
  <ResponsiveIcon
    v-if="props.isVisible"
    v-bind="props.icon"
    :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
    :color="
      getValueFromSources(props.icon?.color, [
        [activePlayerQueue?.repeat_mode == RepeatMode.OFF, null],
        [activePlayerQueue?.repeat_mode == RepeatMode.ALL, 'secondary'],
        [activePlayerQueue?.repeat_mode == RepeatMode.ONE, 'secondary'],
      ])
    "
    :icon="
      getValueFromSources(props.icon?.icon, [
        [activePlayerQueue?.repeat_mode == RepeatMode.OFF, 'mdi-repeat-off'],
        [activePlayerQueue?.repeat_mode == RepeatMode.ALL, 'mdi-repeat'],
        [activePlayerQueue?.repeat_mode == RepeatMode.ONE, 'mdi-repeat-once'],
        [true, 'mdi-repeat-off'],
      ])
    "
    :type="'btn'"
    @click="
      api.queueCommandRepeat(
        activePlayerQueue?.queue_id || '',
        getValueFromSources(null, [
          [activePlayerQueue?.repeat_mode == RepeatMode.OFF, RepeatMode.ONE],
          [activePlayerQueue?.repeat_mode == RepeatMode.ALL, RepeatMode.OFF],
          [activePlayerQueue?.repeat_mode == RepeatMode.ONE, RepeatMode.ALL],
        ]),
      )
    "
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { RepeatMode } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import ResponsiveIcon, { ResponsiveIconProps } from '@/components/mods/ResponsiveIcon.vue';
import { getValueFromSources } from '@/utils';

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
