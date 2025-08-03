<template>
  <!-- skip back button -->
  <ResponsiveIcon
    v-if="isVisible && skipAmount > 0"
    v-bind="icon"
    :disabled="!playerQueue?.active || !curQueueItem"
    icon="mdi-rewind"
    :type="'btn'"
    :title="$t('skip_backward_seconds', [skipAmount])"
    @click="
      playerQueue && skipControlManager.skip(playerQueue.queue_id, -skipAmount)
    "
  >
    <template #default>
      <div class="skip-button-content">
        <v-icon>mdi-rewind</v-icon>
        <span class="skip-amount">{{ skipAmount }}</span>
      </div>
    </template>
  </ResponsiveIcon>
</template>

<script setup lang="ts">
import { PlayerQueue, QueueItem } from "@/plugins/api/interfaces";
import ResponsiveIcon, {
  ResponsiveIconProps,
} from "@/components/mods/ResponsiveIcon.vue";
import { skipControlManager } from "@/helpers/skipControls";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  curQueueItem: QueueItem | undefined;
  skipAmount: number;
  isVisible?: boolean;
  icon?: ResponsiveIconProps;
}
withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});
</script>

<style scoped>
.skip-button-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skip-amount {
  position: absolute;
  font-size: 10px;
  font-weight: bold;
  bottom: -2px;
  right: -2px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 1px 3px;
  min-width: 16px;
  text-align: center;
}
</style>