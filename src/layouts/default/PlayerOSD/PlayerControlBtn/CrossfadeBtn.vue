<template>
  <!-- crossfade button: cycles disabled -> standard -> smart (if available) -> disabled -->
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
    :color="crossfadeMode != CrossfadeMode.DISABLED ? 'primary' : icon?.color"
    variant="button"
    @click="cycleCrossfade"
  >
    <Sparkles
      v-if="crossfadeMode == CrossfadeMode.SMART_CROSSFADE"
      :size="size"
    />
    <Blend v-else :size="size" />
  </Icon>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import api from "@/plugins/api";
import { CrossfadeMode, PlayerQueue } from "@/plugins/api/interfaces";
import {
  isQueueDynamicPlaylist,
  isQueueInfiniteStream,
} from "@/plugins/api/helpers";
import { computed } from "vue";
import { Blend, Sparkles } from "lucide-vue-next";

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

const crossfadeMode = computed(
  () => compProps.playerQueue?.crossfade_mode ?? CrossfadeMode.DISABLED,
);

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

const cycleCrossfade = function () {
  const queue = compProps.playerQueue;
  if (!queue) return;
  // cycle to the next mode, skipping smart crossfade when it is not available
  let nextMode: CrossfadeMode;
  if (crossfadeMode.value == CrossfadeMode.DISABLED) {
    nextMode = CrossfadeMode.STANDARD_CROSSFADE;
  } else if (crossfadeMode.value == CrossfadeMode.STANDARD_CROSSFADE) {
    nextMode = queue.smart_fades_available
      ? CrossfadeMode.SMART_CROSSFADE
      : CrossfadeMode.DISABLED;
  } else {
    nextMode = CrossfadeMode.DISABLED;
  }
  api.queueCommandCrossfade(queue.queue_id, nextMode);
};
</script>
