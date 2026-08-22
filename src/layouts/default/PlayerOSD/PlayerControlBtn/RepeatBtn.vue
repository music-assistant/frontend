<template>
  <!-- repeat button -->
  <Icon
    v-bind="{ ...icon, ...$attrs }"
    :disabled="isDisabled"
    :color="
      getValueFromSources(icon?.color, [
        [repeatMode !== RepeatMode.OFF, 'primary'],
      ])
    "
    :title="repeatTitle"
    :data-dynamic="isDynamic || undefined"
    variant="button"
    @click="cycleRepeatMode"
  >
    <IconRepeatOff v-if="repeatMode === RepeatMode.OFF" :size="size" />
    <IconRepeat v-else-if="repeatMode === RepeatMode.ALL" :size="size" />
    <IconRepeatOnce v-else :size="size" />
  </Icon>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { getValueFromSources } from "@/helpers/utils";
import { useLiveSource } from "@/composables/liveSource";
import api from "@/plugins/api";
import { Player, PlayerQueue, RepeatMode } from "@/plugins/api/interfaces";
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import { $t } from "@/plugins/i18n";
import { computed, toRef } from "vue";
import { IconRepeat, IconRepeatOff, IconRepeatOnce } from "@tabler/icons-vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue: PlayerQueue | undefined;
  icon?: IconProps;
  size?: number;
}
const compProps = withDefaults(defineProps<Props>(), {
  icon: undefined,
  size: 20,
});

const { liveSource } = useLiveSource(
  toRef(compProps, "player"),
  toRef(compProps, "playerQueue"),
);

// A live source that repeats within its own session takes the command instead
// of the queue; one that cannot leaves the button disabled rather than
// silently inert.
const orderingSource = computed(() =>
  liveSource.value?.can_repeat ? liveSource.value : undefined,
);

const isLoading = computed(() => {
  return (
    compProps.playerQueue?.extra_attributes?.play_action_in_progress === true
  );
});

const isDynamic = computed(() => compProps.playerQueue?.is_dynamic === true);

const isInfiniteStream = computed(() =>
  isQueueInfiniteStream(compProps.playerQueue),
);

// The repeat mode in effect: what the live source reports for its own session,
// or the queue's. A source that has not reported one reads as off.
const repeatMode = computed<RepeatMode>(() => {
  if (orderingSource.value) {
    return orderingSource.value.repeat_mode ?? RepeatMode.OFF;
  }
  return compProps.playerQueue?.repeat_mode ?? RepeatMode.OFF;
});

// The next repeat mode when the button is pressed: cycle OFF -> ALL -> ONE.
// (The button is disabled for radio/dynamic queues, so those don't apply here.)
const nextRepeatMode = computed<RepeatMode>(() => {
  if (repeatMode.value === RepeatMode.OFF) return RepeatMode.ALL;
  if (repeatMode.value === RepeatMode.ALL) return RepeatMode.ONE;
  return RepeatMode.OFF;
});

// A live source needs no queue to act on, so only the queue path carries the
// queue's own reasons for being unavailable.
const isDisabled = computed(() => {
  if (isLoading.value) return true;
  if (orderingSource.value) return false;
  return (
    !compProps.playerQueue ||
    !compProps.playerQueue.active ||
    isInfiniteStream.value ||
    isDynamic.value
  );
});

// In dynamic mode the button is disabled; the tooltip explains why.
const repeatTitle = computed<string | undefined>(() =>
  isDynamic.value ? $t("repeat_dynamic_unavailable") : undefined,
);

function cycleRepeatMode() {
  if (orderingSource.value && compProps.player) {
    api.playerCommandRepeat(compProps.player.player_id, nextRepeatMode.value);
    return;
  }
  api.queueCommandRepeat(
    compProps.playerQueue?.queue_id || "",
    nextRepeatMode.value,
  );
}
</script>

<style scoped>
/* Disabled icons drop pointer events (so no tooltip), but in dynamic mode we
   want the title to explain why repeat is unavailable. Re-enable hover just for
   that case; the Icon still guards the click itself. */
.icon-container--disabled[data-dynamic] {
  pointer-events: auto;
}
</style>
