<template>
  <div>
    <Container variant="panel">
      <!-- now playing widget row -->
      <div v-if="nowPlayingWidgetRow.length" class="widget-row">
        <v-toolbar color="transparent" style="width: fit-content">
          <template #prepend><v-icon icon="mdi-playlist-play" /></template>
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
      <!-- all other widget rows -->
      <Suspense>
        <HomeWidgetRows />
        <template #fallback>Loading...</template>
      </Suspense>
    </Container>
  </div>
</template>

<script setup lang="ts">
import api from '@/plugins/api';
import { PlayerState, PlayerQueue } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import Carousel from '@/components/Carousel.vue';
import Container from '@/components/mods/Container.vue';
import HomeWidgetRows from '@/components/HomeWidgetRows.vue';
import PanelviewPlayerCard from '@/components/PanelviewPlayerCard.vue';
import { computed } from 'vue';

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
        api.players[x.queue_id].powered,
    )
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .sort((a, b) => playerStateOrder[a.state] - playerStateOrder[b.state]);
});

const playerQueueClicked = function (queue: PlayerQueue) {
  if (queue && queue.queue_id in api.players) {
    store.selectedPlayerId = queue.queue_id;
  }
};
</script>

<style>
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
