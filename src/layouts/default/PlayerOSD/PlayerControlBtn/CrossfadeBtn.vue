<template>
  <!-- crossfade on/off toggle (shows a "magic" icon when smart fades are active) -->
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
    :color="playerQueue.crossfade_enabled ? 'primary' : icon?.color"
    variant="button"
    @click="
      api.queueCommandCrossfade(
        playerQueue.queue_id,
        !playerQueue.crossfade_enabled,
      )
    "
  >
    <Sparkles v-if="smartFadesActive" :size="size" />
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

// smart fades are "active" when the effective crossfade mode is smart crossfade
const smartFadesActive = computed(
  () => compProps.playerQueue?.crossfade_mode === CrossfadeMode.SMART_CROSSFADE,
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
</script>
