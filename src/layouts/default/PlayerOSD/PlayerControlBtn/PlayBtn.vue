<template>
  <!-- play/pause button: only when MA queue is active -->
  <ResponsiveIcon
    v-if="isVisible && playerQueue"
    v-bind="icon"
    :disabled="playerQueue.items == 0"
    :icon="iconStyle ? `${baseIcon}-${iconStyle}` : baseIcon"
    :type="'btn'"
    @clicked="api.queueCommandPlayPause(playerQueue!.queue_id)"
  />
  <!-- stop button: player is playing other source (not MA)-->
  <ResponsiveIcon
    v-else-if="isVisible && player?.state == PlayerState.PLAYING"
    v-bind="icon"
    icon="mdi-stop"
    :type="'btn'"
    @click="api.queueCommandStop(player!.player_id)"
  />
  <!-- play button: all other situations-->
  <ResponsiveIcon
    v-else-if="isVisible"
    v-bind="icon"
    :disabled="!player?.active_source"
    :icon="`mdi-play-${iconStyle}`"
    :type="'btn'"
    @clicked="api.playerCommandPlay(player?.player_id!)"
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

const baseIcon = computed(() => {
  if (compProps.player?.state == PlayerState.PLAYING) {
    return "mdi-pause";
  }
  return "mdi-play";
});
</script>
