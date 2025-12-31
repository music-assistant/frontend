<template>
  <Button
    v-if="isVisible && player"
    v-bind="icon"
    :disabled="!canPrevious"
    size="icon"
    variant="ghost"
    @click="api.playerCommandPrevious(player.player_id)"
  >
    <StepBack :class="icon?.iconSize ? `size-${icon?.iconSize}` : 'size-4'" />
  </Button>
</template>

<script setup lang="ts">
import {
  Button,
  type ButtonVariants as ButtonProps,
} from "@/components/ui/button";
import { useActiveSource } from "@/composables/activeSource";
import api from "@/plugins/api";
import { Player, PlayerFeature, PlayerQueue } from "@/plugins/api/interfaces";
import { StepBack } from "lucide-vue-next";
import { computed, toRef } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  isVisible?: boolean;
  icon?: ButtonProps & { iconSize?: number };
}
const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  isVisible: true,
  icon: undefined,
});

const { activeSource } = useActiveSource(toRef(compProps, "player"));

const queueHasPrevious = computed(() => {
  if (!compProps.playerQueue?.active) return false;
  if (!compProps.playerQueue?.items || !compProps.playerQueue.current_index)
    return false;
  return compProps.playerQueue.current_index > 0;
});

const playerHasPrevious = computed(() => {
  if (!compProps.player) return false;
  if (compProps.playerQueue?.active) return false;
  if (!compProps.player.current_media) return false;
  return compProps.player.supported_features.includes(
    PlayerFeature.NEXT_PREVIOUS,
  );
});

const canPrevious = computed(() => {
  // Check if active source can next/previous
  if (activeSource.value) {
    return activeSource.value.can_next_previous;
  }
  // Fall back to queue or player capabilities
  return queueHasPrevious.value || playerHasPrevious.value;
});
</script>
