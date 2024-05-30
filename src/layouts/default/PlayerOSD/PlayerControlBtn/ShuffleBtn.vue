<template>
  <!-- shuffle button -->
  <ResponsiveIcon
    v-if="props.isVisible"
    v-bind="props.icon"
    :disabled="
      !store.activePlayerQueue ||
      !store.activePlayerQueue?.active ||
      store.activePlayerQueue?.items == 0
    "
    :color="
      getValueFromSources(props.icon?.color, [
        [store.activePlayerQueue?.shuffle_enabled, 'primary', ''],
      ])
    "
    :icon="
      getValueFromSources(props.icon?.icon, [
        [store.activePlayerQueue?.shuffle_enabled, 'mdi-shuffle'],
        [
          store.activePlayerQueue?.shuffle_enabled == false,
          'mdi-shuffle-disabled',
        ],
        [true, 'mdi-shuffle'],
      ])
    "
    :type="'btn'"
    @click="
      api.queueCommandShuffle(
        store.activePlayerQueue?.queue_id || '',
        store.activePlayerQueue?.shuffle_enabled ? false : true,
      )
    "
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { store } from '@/plugins/store';
import ResponsiveIcon, {
  ResponsiveIconProps,
} from '@/components/mods/ResponsiveIcon.vue';
import { getValueFromSources } from '@/helpers/utils';

// properties
export interface Props {
  isVisible?: boolean;
  icon?: ResponsiveIconProps;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});
</script>
