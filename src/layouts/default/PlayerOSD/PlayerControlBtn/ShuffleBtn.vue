<template>
  <Button
    v-if="isVisible && playerQueue"
    v-bind="icon"
    :disabled="!playerQueue.active || playerQueue.items == 0"
    size="icon"
    variant="ghost"
    @click="
      api.queueCommandShuffle(
        playerQueue.queue_id,
        playerQueue.shuffle_enabled ? false : true,
      )
    "
  >
    <IconArrowsCross
      v-if="playerQueue.shuffle_enabled"
      :class="icon?.iconSize ? `size-${icon?.iconSize}` : 'size-4'"
      :style="{
        color: 'var(--color-primary)',
      }"
    />
    <IconArrowsRight
      v-else
      :class="icon?.iconSize ? `size-${icon?.iconSize}` : 'size-4'"
    />
  </Button>
</template>

<script setup lang="ts">
import {
  Button,
  type ButtonVariants as ButtonProps,
} from "@/components/ui/button";
import api from "@/plugins/api";
import { PlayerQueue } from "@/plugins/api/interfaces";
import { IconArrowsCross, IconArrowsRight } from "@tabler/icons-vue";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  isVisible?: boolean;
  icon?: ButtonProps & { iconSize?: number };
}
withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});
</script>
