<template>
  <!-- shuffle button -->
  <ResponsiveIcon
    v-if="isVisible && playerQueue"
    v-bind="icon"
    :disabled="!playerQueue.active || playerQueue.items == 0"
    :color="
      getValueFromSources(icon?.color, [
        [playerQueue.shuffle_enabled, 'primary', ''],
      ])
    "
    :icon="
      getValueFromSources(icon?.icon, [
        [playerQueue.shuffle_enabled, 'mdi-shuffle'],
        [playerQueue.shuffle_enabled == false, 'mdi-shuffle-disabled'],
        [true, 'mdi-shuffle'],
      ])
    "
    :type="'btn'"
    @click="
      api.queueCommandShuffle(
        playerQueue.queue_id,
        playerQueue.shuffle_enabled ? false : true,
      )
    "
  />
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import ResponsiveIcon, {
  ResponsiveIconProps,
} from "@/components/mods/ResponsiveIcon.vue";
import { getValueFromSources } from "@/helpers/utils";
import { PlayerQueue } from "@/plugins/api/interfaces";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  isVisible?: boolean;
  icon?: ResponsiveIconProps;
}
withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});
</script>
