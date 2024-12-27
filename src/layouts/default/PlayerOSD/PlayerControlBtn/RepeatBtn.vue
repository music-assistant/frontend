<template>
  <!-- repeat button -->
  <ResponsiveIcon
    v-if="isVisible && playerQueue"
    v-bind="icon"
    :disabled="!playerQueue.active || playerQueue.items == 0"
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
    :type="'btn'"
    @click="
      api.queueCommandRepeat(
        playerQueue.queue_id || '',
        getValueFromSources(null, [
          [playerQueue.repeat_mode == RepeatMode.OFF, RepeatMode.ONE],
          [playerQueue.repeat_mode == RepeatMode.ALL, RepeatMode.OFF],
          [playerQueue.repeat_mode == RepeatMode.ONE, RepeatMode.ALL],
        ]),
      )
    "
  />
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { PlayerQueue, RepeatMode } from "@/plugins/api/interfaces";
import ResponsiveIcon, {
  ResponsiveIconProps,
} from "@/components/mods/ResponsiveIcon.vue";
import { getValueFromSources } from "@/helpers/utils";

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
