<template>
  <!-- shuffle button -->
  <Icon
    v-if="isVisible && playerQueue"
    v-bind="{ ...icon, ...$attrs }"
    :disabled="!playerQueue.active || playerQueue.items == 0 || isLoading"
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
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { getValueFromSources } from "@/helpers/utils";
import api from "@/plugins/api";
import { PlayerQueue } from "@/plugins/api/interfaces";
import { computed } from "vue";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  isVisible?: boolean;
  icon?: IconProps;
}
const compProps = withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});

const isLoading = computed(() => {
  return (
    compProps.playerQueue?.extra_attributes?.play_action_in_progress === true
  );
});
</script>
