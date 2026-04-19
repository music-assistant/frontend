<template>
  <!-- shuffle button -->
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
        [playerQueue.shuffle_enabled, 'primary', ''],
      ])
    "
    variant="button"
    @click="
      api.queueCommandShuffle(
        playerQueue.queue_id,
        playerQueue.shuffle_enabled ? false : true,
      )
    "
  >
    <Shuffle v-if="playerQueue.shuffle_enabled" :size="size" />
    <IconArrowsRight v-else :size="size" />
  </Icon>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { getValueFromSources } from "@/helpers/utils";
import api from "@/plugins/api";
import { PlayerQueue } from "@/plugins/api/interfaces";
import { isQueueDynamicPlaylist } from "@/plugins/api/helpers";
import { IconArrowsRight } from "@tabler/icons-vue";
import { Shuffle } from "lucide-vue-next";
import { computed } from "vue";

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
