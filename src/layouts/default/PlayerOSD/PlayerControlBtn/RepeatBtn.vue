<template>
  <!-- repeat button -->
  <Icon
    v-if="isVisible && playerQueue"
    v-bind="{ ...icon, ...$attrs }"
    :disabled="
      !playerQueue.active ||
      playerQueue.items == 0 ||
      isLoading ||
      isSingleDynamicPlaylist ||
      isInfiniteStream
    "
    :color="
      getValueFromSources(icon?.color, [
        [playerQueue.repeat_mode == RepeatMode.OFF, undefined],
        [playerQueue.repeat_mode == RepeatMode.ALL, 'primary'],
        [playerQueue.repeat_mode == RepeatMode.ONE, 'primary'],
      ])
    "
    :aria-label="repeatButtonLabel"
    :aria-pressed="playerQueue.repeat_mode == RepeatMode.OFF ? 'false' : 'true'"
    :title="repeatButtonLabel"
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
import { PlayerQueue, RepeatMode } from "@/plugins/api/interfaces";
import {
  isQueueDynamicPlaylist,
  isQueueInfiniteStream,
} from "@/plugins/api/helpers";
import { computed } from "vue";
import { IconRepeat, IconRepeatOff, IconRepeatOnce } from "@tabler/icons-vue";
import { useI18n } from "vue-i18n";

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
const { t } = useI18n();

const repeatButtonLabel = computed(() => {
  const repeatMode = compProps.playerQueue?.repeat_mode ?? RepeatMode.OFF;
  return `${t("select_repeat_mode")}: ${t(`repeat_mode.${repeatMode}`)}`;
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
</script>
