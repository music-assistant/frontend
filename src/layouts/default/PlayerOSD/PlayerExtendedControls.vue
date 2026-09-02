<template>
  <div class="player-bar-action-row flex min-w-0 items-center">
    <div
      v-if="volume?.isVisible && store.activePlayer"
      class="player-bar-volume-control-slot flex items-center"
    >
      <PlayerBarVolumeControl :player="store.activePlayer" />
    </div>
    <div
      v-if="player?.isVisible"
      class="player-bar-target-controls flex min-w-0 items-center"
    >
      <PlayerBarPlayerButton />
      <PlayerBarGroupControl />
    </div>
  </div>
</template>

<script setup lang="ts">
import { store } from "@/plugins/store";
import PlayerBarGroupControl from "./PlayerBarGroupControl.vue";
import PlayerBarPlayerButton from "./PlayerBarPlayerButton.vue";
import PlayerBarVolumeControl from "./PlayerBarVolumeControl.vue";

export interface Props {
  player?: {
    isVisible?: boolean;
  };
  volume?: {
    isVisible?: boolean;
  };
}

withDefaults(defineProps<Props>(), {
  player: () => ({ isVisible: true }),
  volume: () => ({ isVisible: true }),
});
</script>
