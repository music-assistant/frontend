<template>
  <div class="player-bar-action-row flex min-w-0 items-center">
    <Button
      v-if="favorite?.isVisible && favoriteItem"
      variant="ghost"
      class="player-control-button player-bar-action h-20 w-12 rounded-none px-1"
      :aria-label="
        $t(favoriteItem.favorite ? 'favorites_remove' : 'favorites_add')
      "
      @click="api.toggleFavorite(favoriteItem)"
    >
      <span class="player-bar-action-icon">
        <Heart
          class="size-7"
          :fill="favoriteItem.favorite ? 'currentColor' : 'none'"
        />
      </span>
      <span class="player-bar-action-label" aria-hidden="true">&nbsp;</span>
    </Button>

    <SleepTimerBtn
      v-if="sleepTimer?.isVisible"
      class="player-bar-sleep-timer"
    />

    <QueueBtn
      v-if="queue?.isVisible"
      player-bar
      :size="28"
      class="player-control-button player-bar-action h-20 w-12 rounded-none px-1"
    />

    <PlayerTrackMenu
      v-if="contextMenu?.isVisible"
      :show-favorite="favorite?.showInMenu ?? !favorite?.isVisible"
      :show-queue="queue?.showInMenu ?? !queue?.isVisible"
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
import { Button } from "@/components/ui/button";
import api from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { Heart } from "@lucide/vue";
import { computed } from "vue";
import PlayerBarGroupControl from "./PlayerBarGroupControl.vue";
import PlayerBarPlayerButton from "./PlayerBarPlayerButton.vue";
import PlayerBarVolumeControl from "./PlayerBarVolumeControl.vue";
import PlayerTrackMenu from "./PlayerControlBtn/PlayerTrackMenu.vue";
import QueueBtn from "./PlayerControlBtn/QueueBtn.vue";
import SleepTimerBtn from "./PlayerControlBtn/SleepTimerBtn.vue";

export interface Props {
  favorite?: {
    isVisible?: boolean;
    showInMenu?: boolean;
  };
  queue?: {
    isVisible?: boolean;
    showInMenu?: boolean;
  };
  player?: {
    isVisible?: boolean;
  };
  volume?: {
    isVisible?: boolean;
  };
  contextMenu?: {
    isVisible?: boolean;
  };
  sleepTimer?: {
    isVisible?: boolean;
  };
}

withDefaults(defineProps<Props>(), {
  favorite: () => ({ isVisible: false }),
  queue: () => ({ isVisible: true }),
  player: () => ({ isVisible: true }),
  volume: () => ({ isVisible: true }),
  contextMenu: () => ({ isVisible: true }),
  sleepTimer: () => ({ isVisible: true }),
});

const favoriteItem = computed(() => {
  const item = store.curQueueItem?.media_item;
  return item?.media_type === MediaType.AUDIO_SOURCE ? undefined : item;
});
</script>
