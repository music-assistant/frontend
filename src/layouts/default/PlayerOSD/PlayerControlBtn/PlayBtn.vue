<template>
  <Button
    v-if="isVisible && player"
    v-bind="icon"
    :disabled="!canPlayPause"
    size="icon"
    variant="inverted"
    :class="
      icon?.isFullscreen ? `rounded-full h-14 w-14` : 'rounded-full h-10 w-10'
    "
    @click="api.playerCommandPlayPause(player.player_id)"
  >
    <Pause
      v-if="player.playback_state == PlaybackState.PLAYING"
      :class="icon?.iconSize ? `size-${icon?.iconSize}` : 'size-4'"
    />
    <Play
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
import { useActiveSource } from "@/composables/activeSource";
import api from "@/plugins/api";
import { PlaybackState, Player, PlayerQueue } from "@/plugins/api/interfaces";
import { Pause, Play } from "lucide-vue-next";
import { computed, toRef } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  isVisible?: boolean;
  withCircle?: boolean;
  icon?: ButtonProps & { iconSize?: number; isFullscreen?: boolean };
  iconStyle?: string;
}
const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  isVisible: true,
  withCircle: true,
  icon: undefined,
  iconStyle: "circle",
});

const { activeSource } = useActiveSource(toRef(compProps, "player"));

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

const canPlayPause = computed(() => {
  // Check if active source can play/pause
  if (activeSource.value) {
    return activeSource.value.can_play_pause;
  }
  // Fall back to queue or player capabilities
  return queueCanPlay.value || playerCanPlay.value;
});
</script>
