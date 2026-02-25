<template>
  <!-- repeat button -->
  <Icon
    v-if="isVisible && playerQueue"
    v-bind="{ ...icon, ...$attrs }"
    :disabled="!playerQueue.active || playerQueue.items == 0 || isLoading"
    :color="
      getValueFromSources(icon?.color, [
        [playerQueue.repeat_mode == RepeatMode.OFF, null],
        [playerQueue.repeat_mode == RepeatMode.ALL, 'primary'],
        [playerQueue.repeat_mode == RepeatMode.ONE, 'primary'],
      ])
    "
    :icon="
      getValueFromSources(icon?.icon, [
        [playerQueue.repeat_mode == RepeatMode.OFF, 'mdi-repeat-off'],
        [playerQueue.repeat_mode == RepeatMode.ALL, 'mdi-repeat'],
        [playerQueue.repeat_mode == RepeatMode.ONE, 'mdi-repeat-once'],
        [true, 'mdi-repeat-off'],
      ])
    "
    variant="button"
    @click="
      api.queueCommandRepeat(
        playerQueue.queue_id || '',
        getValueFromSources(null, [
          [playerQueue.repeat_mode == RepeatMode.OFF, RepeatMode.ALL],
          [playerQueue.repeat_mode == RepeatMode.ALL, RepeatMode.ONE],
          [playerQueue.repeat_mode == RepeatMode.ONE, RepeatMode.OFF],
        ]),
      )
    "
  />
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { getValueFromSources } from "@/helpers/utils";
import api from "@/plugins/api";
import { PlayerQueue, RepeatMode } from "@/plugins/api/interfaces";
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
