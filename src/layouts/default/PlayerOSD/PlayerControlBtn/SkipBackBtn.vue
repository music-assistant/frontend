<template>
  <!-- skip back button -->
  <Icon
    v-if="isVisible"
    v-bind="icon"
    :disabled="!playerQueue?.active || !curQueueItem"
    icon="mdi-rewind"
    variant="button"
    :title="$t('skip_backward_seconds', [skipAmount])"
    @click="
      playerQueue && api.queueCommandSkip(playerQueue.queue_id, -skipAmount)
    "
  />
</template>

<script setup lang="ts">
import Icon, { IconProps } from "@/components/Icon.vue";
import api from "@/plugins/api";
import { PlayerQueue, QueueItem } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  curQueueItem: QueueItem | undefined;
  skipAmount: number;
  isVisible?: boolean;
  icon?: IconProps;
}
withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});
</script>
