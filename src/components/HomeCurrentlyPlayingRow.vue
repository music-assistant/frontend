<!-- This is very similar to HomeWidgetRow. Should probably refactor at some point to clean up -->
<template>
  <div v-if="nowPlayingWidgetRow.length" class="widget-row">
    <v-toolbar class="header" color="transparent" style="width: fit-content">
      <template #prepend><v-icon icon="mdi-play-circle-outline" /></template>
      <template #title>
        <span class="mr-3">{{ $t('currently_playing') }}</span>
      </template>
    </v-toolbar>
    <swiper>
      <swiper-slide
        v-for="queue in nowPlayingWidgetRow"
        :key="queue.queue_id"
        style="max-width: 400px; width: 300px"
      >
        <PanelviewPlayerCard
          :queue="queue"
          @click="playerQueueClicked(queue)"
        />
      </swiper-slide>
    </swiper>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PlayerState, PlayerQueue } from '@/plugins/api/interfaces';
import api from '@/plugins/api';
import { store } from '@/plugins/store';
import PanelviewPlayerCard from '@/components/PanelviewPlayerCard.vue';

const playerStateOrder = {
  [PlayerState.PLAYING]: 1,
  [PlayerState.PAUSED]: 2,
  [PlayerState.IDLE]: 2,
} as const;

const nowPlayingWidgetRow = computed(() => {
  return Object.values(api.queues)
    .filter(
      (x) =>
        x.active &&
        x.items > 0 &&
        x.queue_id in api.players &&
        api.players[x.queue_id].powered &&
        // only show players that are playing or paused
        [PlayerState.PLAYING, PlayerState.PAUSED].includes(
          api.players[x.queue_id].state,
        ),
    )
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .sort((a, b) => playerStateOrder[a.state] - playerStateOrder[b.state]);
});

function playerQueueClicked(queue: PlayerQueue) {
  if (queue && queue.queue_id in api.players) {
    if (store.activePlayerId == queue.queue_id) {
      store.showFullscreenPlayer = true;
    } else {
      store.activePlayerId = queue.queue_id;
    }
  }
}
</script>

<style scoped>
.header.v-toolbar {
  height: 55px;
  font-family: 'JetBrains Mono Medium';
}

.home-card {
  min-width: 80px;
  text-align: center;
  padding-top: 12px;
  padding-bottom: 8px;
}

.widget-row {
  margin-bottom: 20px;
  margin-left: 0px;
  padding-left: 0px;
}

.widget-row-panel-item {
  margin-bottom: 10px;
}
.v-slide-group__prev {
  min-width: 0px !important;
}

.v-slide-group__prev.v-slide-group__prev--disabled {
  visibility: hidden;
  margin-right: -15px;
}

.v-slide-group__next {
  min-width: 15px !important;
}

.v-slide-group__next.v-slide-group__next--disabled {
  visibility: hidden;
}
</style>
