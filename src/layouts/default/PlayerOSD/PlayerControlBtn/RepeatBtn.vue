<template>
  <!-- repeat button -->
  <Icon
    v-if="isVisible && playerQueue"
    v-bind="{ ...icon, ...$attrs }"
    :disabled="
      !playerQueue.active ||
      playerQueue.items == 0 ||
      isLoading ||
      isSingleDynamicPlaylist
    "
    :color="
      getValueFromSources(icon?.color, [
        [playerQueue.repeat_mode == RepeatMode.OFF, undefined],
        [playerQueue.repeat_mode == RepeatMode.ALL, 'primary'],
        [playerQueue.repeat_mode == RepeatMode.ONE, 'primary'],
      ])
    "
    variant="button"
    @click="
      api.queueCommandRepeat(
        playerQueue.queue_id || '',
        getValueFromSources(undefined as RepeatMode | undefined, [
          [playerQueue.repeat_mode == RepeatMode.OFF, RepeatMode.ALL],
          [playerQueue.repeat_mode == RepeatMode.ALL, RepeatMode.ONE],
          [playerQueue.repeat_mode == RepeatMode.ONE, RepeatMode.OFF],
        ]) ?? RepeatMode.OFF,
      )
    "
  >
    <IconRepeatOff
      v-if="playerQueue.repeat_mode == RepeatMode.OFF"
      :size="size"
    />
    <IconRepeat
      v-else-if="playerQueue.repeat_mode == RepeatMode.ALL"
      :size="size"
    />
    <IconRepeatOnce v-else :size="size" />
  </Icon>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { getValueFromSources } from "@/helpers/utils";
import api from "@/plugins/api";
import {
  PlayerQueue,
  RepeatMode,
} from "@/plugins/api/interfaces";
import { isQueueDynamicPlaylist } from "@/plugins/api/helpers";
import { computed } from "vue";
import { IconRepeat, IconRepeatOff, IconRepeatOnce } from "@tabler/icons-vue";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  isVisible?: boolean;
  icon?: IconProps;
  size?: number;
}
const compProps = withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
  size: 20,
});

const isLoading = computed(() => {
  return (
    compProps.playerQueue?.extra_attributes?.play_action_in_progress === true
  );
});

const isSingleDynamicPlaylist = computed(() => isQueueDynamicPlaylist(compProps.playerQueue));
</script>
