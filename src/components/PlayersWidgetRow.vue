<template>
  <div :class="`widget-row ${settings && !settings.enabled ? 'disabled' : ''}`">
    <v-toolbar class="header" color="transparent">
      <template #title>
        <span class="mr-3">{{ $t("players") }}</span>
      </template>
      <template #append>
        <div v-if="editMode">
          <!-- enable/disable checkbox -->
          <v-btn
            :icon="
              settings.enabled
                ? 'mdi-checkbox-marked'
                : 'mdi-checkbox-blank-outline'
            "
            @click="
              emit('update:settings', {
                ...settings,
                enabled: !settings.enabled,
              })
            "
          />
        </div>
      </template>
    </v-toolbar>

    <swiper
      :slides-per-view="'auto'"
      :space-between="15"
      :free-mode="false"
      :navigation="false"
      :mousewheel="{
        forceToAxis: true,
        releaseOnEdges: true,
      }"
    >
      <swiper-slide v-for="player in sortedPlayers" :key="player.player_id">
        <PlayerCard
          :id="player.player_id"
          :key="player.player_id"
          :player="player"
          :show-volume-control="false"
          :show-menu-button="false"
          :show-sub-players="false"
          :show-sync-controls="false"
          style="width: 305px"
          @click="playerClicked(player)"
        />
      </swiper-slide>
    </swiper>
  </div>
</template>

<script setup lang="ts">
import { Player } from "@/plugins/api/interfaces";
import { computed } from "vue";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { api } from "@/plugins/api";
import PlayerCard from "@/components/PlayerCard.vue";
import { playerVisible } from "@/helpers/utils";
import { WidgetRowSettings } from "./WidgetRow.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";

const sortedPlayers = computed(() => {
  return Object.values(api.players)
    .filter((x) => playerVisible(x))
    .sort((a, b) => (a.name.toUpperCase() > b.name?.toUpperCase() ? 1 : -1))
    .sort((a, b) => {
      return playerSortScore(a) - playerSortScore(b);
    });
});

interface Props {
  settings: WidgetRowSettings;
  editMode: boolean;
}
defineProps<Props>();

const emit = defineEmits(["update:settings"]);

function playerClicked(player: Player) {
  store.activePlayerId = player.player_id;
}

function playerSortScore(player: Player) {
  if (player.playback_state == PlaybackState.PLAYING) {
    return 0;
  }
  if (player.playback_state == PlaybackState.PAUSED) {
    return 1;
  }
  if (player.current_media && player.powered) return 3;
  if (player.current_media) return 4;
  return 99;
}
</script>

<style scoped>
.header.v-toolbar :deep(.v-toolbar-title) {
  margin-inline-start: 0px;
  font-size: x-large;
  font-weight: bold;
}

.widget-row {
  margin-bottom: 10px;
  margin-left: 0px;
  margin-right: 0px;
  padding-left: 0px;
}

.disabled {
  opacity: 0.2;
}
.enabled {
  opacity: 1;
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

:deep(.swiper-slide) {
  width: auto;
}
</style>
