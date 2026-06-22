<template>
  <!-- repeat button -->
  <Icon
    v-if="isVisible && playerQueue"
    v-bind="{ ...icon, ...$attrs }"
    :disabled="!playerQueue.active || isLoading || isInfiniteStream"
    :color="
      getValueFromSources(icon?.color, [
        [playerQueue.repeat_mode == RepeatMode.OFF, undefined],
        [playerQueue.repeat_mode == RepeatMode.ALL, 'primary'],
        [playerQueue.repeat_mode == RepeatMode.ONE, 'primary'],
      ])
    "
    variant="button"
    @click="api.queueCommandRepeat(playerQueue.queue_id || '', nextRepeatMode)"
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
import { PlayerQueue, RepeatMode } from "@/plugins/api/interfaces";
import {
  isQueueDynamicPlaylist,
  isQueueInfiniteStream,
} from "@/plugins/api/helpers";
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

const isSingleDynamicPlaylist = computed(() =>
  isQueueDynamicPlaylist(compProps.playerQueue),
);

const isInfiniteStream = computed(() =>
  isQueueInfiniteStream(compProps.playerQueue),
);

// Determine the next repeat mode when the button is pressed. Radio/dynamic
// queues have no defined end, so "repeat all" doesn't apply there — only allow
// toggling "repeat one" on and off.
const nextRepeatMode = computed<RepeatMode>(() => {
  const current = compProps.playerQueue?.repeat_mode ?? RepeatMode.OFF;
  if (isSingleDynamicPlaylist.value) {
    return current === RepeatMode.ONE ? RepeatMode.OFF : RepeatMode.ONE;
  }
  if (current === RepeatMode.OFF) return RepeatMode.ALL;
  if (current === RepeatMode.ALL) return RepeatMode.ONE;
  return RepeatMode.OFF;
});
</script>
