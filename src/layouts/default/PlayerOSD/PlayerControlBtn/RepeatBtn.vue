<template>
  <Button
    v-if="isVisible && playerQueue"
    v-bind="icon"
    :disabled="!playerQueue.active || playerQueue.items == 0"
    size="icon"
    variant="ghost"
    @click="
      api.queueCommandRepeat(
        playerQueue.queue_id || '',
        getValueFromSources(null, [
          [playerQueue.repeat_mode == RepeatMode.OFF, RepeatMode.ALL],
          [playerQueue.repeat_mode == RepeatMode.ALL, RepeatMode.ONE],
          [playerQueue.repeat_mode == RepeatMode.ONE, RepeatMode.OFF],
        ]),
      )
    "
  >
    <IconRepeat
      v-if="playerQueue.repeat_mode == RepeatMode.ALL"
      :class="icon?.iconSize ? `size-${icon?.iconSize}` : 'size-4'"
      :style="{
        color: 'var(--color-primary)',
      }"
    />
    <IconRepeatOnce
      v-else-if="playerQueue.repeat_mode == RepeatMode.ONE"
      :class="icon?.iconSize ? `size-${icon?.iconSize}` : 'size-4'"
      :style="{
        color: 'var(--color-primary)',
      }"
    />
    <IconRepeatOff
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
import { getValueFromSources } from "@/helpers/utils";
import api from "@/plugins/api";
import { PlayerQueue, RepeatMode } from "@/plugins/api/interfaces";
import { IconRepeat, IconRepeatOff, IconRepeatOnce } from "@tabler/icons-vue";

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
