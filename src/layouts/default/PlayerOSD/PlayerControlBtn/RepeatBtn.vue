<template>
  <!-- repeat button -->
  <Icon
    v-bind="{ ...icon, ...$attrs }"
    :disabled="
      !playerQueue ||
      !playerQueue.active ||
      isLoading ||
      isInfiniteStream ||
      isDynamic
    "
    :color="
      getValueFromSources(icon?.color, [
        [playerQueue?.repeat_mode == RepeatMode.OFF, undefined],
        [playerQueue?.repeat_mode == RepeatMode.ALL, 'primary'],
        [playerQueue?.repeat_mode == RepeatMode.ONE, 'primary'],
      ])
    "
    variant="button"
    @click="api.queueCommandRepeat(playerQueue?.queue_id || '', nextRepeatMode)"
  >
    <IconRepeatOff
      v-if="playerQueue?.repeat_mode == RepeatMode.OFF"
      :size="size"
    />
    <IconRepeat
      v-else-if="playerQueue?.repeat_mode == RepeatMode.ALL"
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
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import { computed } from "vue";
import { IconRepeat, IconRepeatOff, IconRepeatOnce } from "@tabler/icons-vue";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  icon?: IconProps;
  size?: number;
}
const compProps = withDefaults(defineProps<Props>(), {
  icon: undefined,
  size: 20,
});

const isLoading = computed(() => {
  return (
    compProps.playerQueue?.extra_attributes?.play_action_in_progress === true
  );
});

const isDynamic = computed(() => compProps.playerQueue?.is_dynamic === true);

const isInfiniteStream = computed(() =>
  isQueueInfiniteStream(compProps.playerQueue),
);

// The next repeat mode when the button is pressed: cycle OFF -> ALL -> ONE.
// (The button is disabled for radio/dynamic queues, so those don't apply here.)
const nextRepeatMode = computed<RepeatMode>(() => {
  const current = compProps.playerQueue?.repeat_mode ?? RepeatMode.OFF;
  if (current === RepeatMode.OFF) return RepeatMode.ALL;
  if (current === RepeatMode.ALL) return RepeatMode.ONE;
  return RepeatMode.OFF;
});
</script>
