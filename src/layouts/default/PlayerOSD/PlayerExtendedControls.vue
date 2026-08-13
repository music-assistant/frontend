<template>
  <div class="player-bar-action-row flex min-w-0 items-center">
    <SleepTimerBtn
      v-if="sleepTimer?.isVisible"
      class="player-bar-sleep-timer"
    />

    <PlayerBarVolumeControl
      v-if="volume?.isVisible && store.activePlayer"
      :player="store.activePlayer"
    />
    <PlayerBarGroupControl v-if="player?.isVisible" />
    <PlayerBarPlayerButton v-if="player?.isVisible" />
  </div>
</template>

<script setup lang="ts">
import { store } from "@/plugins/store";
import PlayerBarGroupControl from "./PlayerBarGroupControl.vue";
import PlayerBarPlayerButton from "./PlayerBarPlayerButton.vue";
import PlayerBarVolumeControl from "./PlayerBarVolumeControl.vue";
import SleepTimerBtn from "./PlayerControlBtn/SleepTimerBtn.vue";

export interface Props {
  player?: {
    isVisible?: boolean;
  };
  volume?: {
    isVisible?: boolean;
  };
  sleepTimer?: {
    isVisible?: boolean;
  };
}

withDefaults(defineProps<Props>(), {
  player: () => ({ isVisible: true }),
  volume: () => ({ isVisible: true }),
  sleepTimer: () => ({ isVisible: true }),
});
</script>
