<template>
  <!-- next button -->
  <ResponsiveIcon
    v-if="props.isVisible"
    v-bind="props.icon"
    :disabled="
      !store.activePlayerQueue ||
      !store.activePlayerQueue?.active ||
      store.activePlayerQueue?.items == 0
    "
    icon="mdi-skip-next-outline"
    :type="'btn'"
    @click="api.queueCommandNext(store.activePlayerQueue!.queue_id)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { store } from '@/plugins/store';
import ResponsiveIcon, {
  ResponsiveIconProps,
} from '@/components/mods/ResponsiveIcon.vue';

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
