<template>
  <!-- repeat button -->
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
        [store.activePlayerQueue?.repeat_mode == RepeatMode.OFF, null],
        [store.activePlayerQueue?.repeat_mode == RepeatMode.ALL, 'primary'],
        [store.activePlayerQueue?.repeat_mode == RepeatMode.ONE, 'primary'],
      ])
    "
    :icon="
      getValueFromSources(props.icon?.icon, [
        [
          store.activePlayerQueue?.repeat_mode == RepeatMode.OFF,
          'mdi-repeat-off',
        ],
        [store.activePlayerQueue?.repeat_mode == RepeatMode.ALL, 'mdi-repeat'],
        [
          store.activePlayerQueue?.repeat_mode == RepeatMode.ONE,
          'mdi-repeat-once',
        ],
        [true, 'mdi-repeat-off'],
      ])
    "
    :type="'btn'"
    @click="
      api.queueCommandRepeat(
        store.activePlayerQueue?.queue_id || '',
        getValueFromSources(null, [
          [
            store.activePlayerQueue?.repeat_mode == RepeatMode.OFF,
            RepeatMode.ONE,
          ],
          [
            store.activePlayerQueue?.repeat_mode == RepeatMode.ALL,
            RepeatMode.OFF,
          ],
          [
            store.activePlayerQueue?.repeat_mode == RepeatMode.ONE,
            RepeatMode.ALL,
          ],
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
