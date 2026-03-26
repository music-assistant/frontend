<template>
  <div :class="`widget-row ${settings && !settings.enabled ? 'disabled' : ''}`">
    <div class="header flex items-center h-10 px-1">
      <div class="flex-1 min-w-0">
        <span class="mr-3 text-lg font-bold">{{ $t("players") }}</span>
      </div>
      <div class="flex items-center">
        <div v-if="editMode">
          <!-- enable/disable checkbox -->
          <Button
            variant="ghost"
            size="icon"
            @click="
              emit('update:settings', {
                ...settings,
                enabled: !settings.enabled,
              })
            "
          >
            <CheckSquare v-if="settings.enabled" class="h-5 w-5" />
            <Square v-else class="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>

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
      <swiper-slide
        v-for="player in sortedPlayers"
        :key="player.player_id"
        style="width: 240px"
      >
        <PlayerCard
          :id="player.player_id"
          :key="player.player_id"
          :player="player"
          :show-volume-control="false"
          :show-menu-button="false"
          :show-sub-players="false"
          :show-sync-controls="false"
          @click="playerClicked(player)"
        />
      </swiper-slide>
    </swiper>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import PlayerCard from "@/components/PlayerCard.vue";
import { playerVisible } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { PlaybackState, Player } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { CheckSquare, Square } from "lucide-vue-next";
import { computed } from "vue";
import { WidgetRowSettings } from "./WidgetRow.vue";

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
.widget-row {
  margin-bottom: 10px;
  margin-left: 0px;
  margin-right: 0px;
  padding-left: 0px;
}

@media (max-width: 575px) {
  .widget-row {
    margin-bottom: 4px;
  }
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
</style>
