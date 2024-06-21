<template>
  <!-- next button -->
  <ResponsiveIcon
    v-if="isVisible"
    v-bind="icon"
    :disabled="
      !store.activePlayerQueue ||
      !store.activePlayerQueue?.active ||
      store.activePlayerQueue?.items <= 1
    "
    icon="mdi-skip-next-outline"
    :type="'btn'"
    @clicked="api.queueCommandNext(store.activePlayerQueue!.queue_id)"
  />
</template>

<script setup lang="ts">
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
withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});
</script>
