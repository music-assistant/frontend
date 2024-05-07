<!-- This is very similar to HomeWidgetRow. Should probably refactor at some point to clean up -->
<template>
  <div v-if="nowPlayingWidgetRow.length" class="widget-row">
    <v-toolbar class="header" color="transparent" style="width: fit-content">
      <template #prepend><v-icon icon="mdi-play-circle-outline" /></template>
      <template #title>
        <span class="mr-3">{{ $t('currently_playing') }}</span>
      </template>
    </v-toolbar>
    <carousel>
      <swiper-slide
        v-for="queue in nowPlayingWidgetRow"
        :key="queue.queue_id"
        style="min-width: 300px; max-width: 500px"
      >
        <PanelviewPlayerCard
          :queue="queue"
          @click="playerQueueClicked(queue)"
        />
      </swiper-slide>
    </carousel>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PlayerState, PlayerQueue } from '@/plugins/api/interfaces';
import api from '@/plugins/api';
import { store } from '@/plugins/store';
import Carousel from '@/components/Carousel.vue';
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
    if (store.selectedPlayerId == queue.queue_id) {
      store.showFullscreenPlayer = true;
    } else {
      store.selectedPlayerId = queue.queue_id;
    }
  }
}
</script>

<style scoped>
.header.v-toolbar {
  height: 55px;
  font-family: 'JetBrains Mono Medium';
}
.widget-row {
  margin-bottom: 20px;
  margin-left: 0px;
  padding-left: 0px;
}
</style>
