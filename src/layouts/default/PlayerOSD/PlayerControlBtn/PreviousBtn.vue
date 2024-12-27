<template>
  <!-- prev button -->
  <ResponsiveIcon
    v-if="isVisible && player"
    v-bind="icon"
    :disabled="!queueHasPrevious && !playerHasPrevious"
    icon="mdi-skip-previous-outline"
    :type="'btn'"
    @click="api.playerCommandPrevious(player.player_id)"
  />
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { Player, PlayerFeature, PlayerQueue } from "@/plugins/api/interfaces";
import ResponsiveIcon, {
  ResponsiveIconProps,
} from "@/components/mods/ResponsiveIcon.vue";
import { computed } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  isVisible?: boolean;
  icon?: ResponsiveIconProps;
}
const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  isVisible: true,
  icon: undefined,
});

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
</script>
