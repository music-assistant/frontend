<!-- This is very similar to HomeWidgetRow. Should probably refactor at some point to clean up -->
<template>
  <div v-if="activePlayers.length" class="widget-row">
    <v-toolbar class="header" color="transparent" style="width: fit-content">
      <template #prepend><v-icon icon="mdi-play-circle-outline" /></template>
      <template #title>
        <span class="mr-3">{{ $t('currently_playing') }}</span>
      </template>
    </v-toolbar>
    <swiper>
      <swiper-slide
        v-for="player in activePlayers"
        :key="player.player_id"
        style="max-width: 340px; width: 340px"
      >
        <PanelviewPlayerCard
          :player="player"
          style="width: 300px; height: 80px; max-height: 80px"
          @click="playerClicked(player)"
        />
      </swiper-slide>
    </swiper>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PlayerState, Player } from '@/plugins/api/interfaces';
import api from '@/plugins/api';
import { store } from '@/plugins/store';
import PanelviewPlayerCard from '@/components/PanelviewPlayerCard.vue';

const playerStateOrder = {
  [PlayerState.PLAYING]: 1,
  [PlayerState.PAUSED]: 2,
  [PlayerState.IDLE]: 2,
} as const;

const activePlayers = computed(() => {
  return Object.values(api.players)
    .filter(
      (x) =>
        x.powered &&
        // hide synced players or group child's
        !x.synced_to &&
        !x.active_group &&
        // only show players that are playing or paused
        [PlayerState.PLAYING, PlayerState.PAUSED].includes(x.state),
    )
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .sort((a, b) => playerStateOrder[a.state] - playerStateOrder[b.state]);
});

function playerClicked(player: Player) {
  if (player && player.player_id in api.players) {
    if (store.activePlayerId == player.player_id) {
      store.showFullscreenPlayer = true;
    } else {
      store.activePlayerId = player.player_id;
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
