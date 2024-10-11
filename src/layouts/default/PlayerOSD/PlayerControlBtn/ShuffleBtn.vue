<template>
  <!-- shuffle button -->
  <ResponsiveIcon
    v-if="isVisible"
    v-bind="icon"
    :disabled="
      !store.activePlayerQueue ||
      !store.activePlayerQueue?.active ||
      store.activePlayerQueue?.items == 0
    "
    :color="
      getValueFromSources(icon?.color, [
        [store.activePlayerQueue?.shuffle_enabled, 'primary', ''],
      ])
    "
    :icon="
      getValueFromSources(icon?.icon, [
        [store.activePlayerQueue?.shuffle_enabled, 'mdi-shuffle'],
        [
          store.activePlayerQueue?.shuffle_enabled == false,
          'mdi-shuffle-disabled',
        ],
        [true, 'mdi-shuffle'],
      ])
    "
    :type="'btn'"
    @clicked="
      api.queueCommandShuffle(
        store.activePlayerQueue?.queue_id || '',
        store.activePlayerQueue?.shuffle_enabled ? false : true,
      )
    "
  />
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import ResponsiveIcon, {
  ResponsiveIconProps,
} from "@/components/mods/ResponsiveIcon.vue";
import { getValueFromSources } from "@/helpers/utils";

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
