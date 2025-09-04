<template>
  <!-- shuffle button -->
  <Icon
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
    variant="button"
    @click="
      api.queueCommandShuffle(
        playerQueue.queue_id,
        playerQueue.shuffle_enabled ? false : true,
      )
    "
  />
</template>

<script setup lang="ts">
import Icon, { IconProps } from "@/components/Icon.vue";
import { getValueFromSources } from "@/helpers/utils";
import api from "@/plugins/api";
import { PlayerQueue } from "@/plugins/api/interfaces";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  isVisible?: boolean;
  icon?: IconProps;
}
withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});
</script>
