<template>
  <!-- play/pause button: disabled if no content -->
  <ResponsiveIcon
    v-if="isVisible && player"
    v-bind="icon"
    :disabled="!queueCanPlay && !playerCanPlay"
    :icon="iconStyle ? `${baseIcon}-${iconStyle}` : baseIcon"
    :type="'btn'"
    @click="api.playerCommandPlayPause(player.player_id)"
  />
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { PlayerState, Player, PlayerQueue } from "@/plugins/api/interfaces";
import ResponsiveIcon, {
  ResponsiveIconProps,
} from "@/components/mods/ResponsiveIcon.vue";
import { computed } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  isVisible?: boolean;
  withCircle?: boolean;
  icon?: ResponsiveIconProps;
  iconStyle?: string;
}
const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  isVisible: true,
  withCircle: true,
  icon: undefined,
  iconStyle: "circle",
});
const queueCanPlay = computed(() => {
  if (!compProps.playerQueue) return false;
  return compProps.playerQueue.items > 0;
});
const playerCanPlay = computed(() => {
  if (!compProps.player) return false;
  if (compProps.playerQueue?.active) return false;
  if (!compProps.player.current_media) return false;
  return true;
});
const baseIcon = computed(() => {
  if (compProps.player?.state == PlayerState.PLAYING) {
    return "mdi-pause";
  }
  return "mdi-play";
});
</script>
