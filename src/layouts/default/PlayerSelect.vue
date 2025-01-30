<template>
  <!-- players side menu -->
  <v-overlay v-model="store.showPlayersMenu" />
  <v-navigation-drawer
    v-if="store.showPlayersMenu"
    v-model="store.showPlayersMenu"
    location="right"
    app
    clipped
    temporary
    touchless
    :width="500"
    style="z-index: 99999"
    z-index="99999"
  >
    <div>
      <!-- heading with Players as title-->
      <v-card-title
        class="title"
        style="padding-top: 20px; padding-bottom: 20px"
      >
        <b>{{ $t("players") }}</b>
        <div style="float: right; margin-right: -20px">
          <!-- settings button -->
          <Button variant="icon" :to="{ name: 'playersettings' }">
            <v-icon size="30">mdi-cog-outline</v-icon>
          </Button>
          <!-- close button -->
          <Button variant="icon" @click="store.showPlayersMenu = false">
            <v-icon size="30">mdi-window-close</v-icon>
          </Button>
        </div>
      </v-card-title>

      <v-divider />

      <v-list flat style="margin: 10px 5px 15px 5px">
        <PlayerCard
          v-for="player in sortedPlayers.filter(
            (x) =>
              [PlayerState.PLAYING, PlayerState.PAUSED].includes(x.state!) ||
              (api.queues[x.player_id]?.items > 0 && x.powered != false),
          )"
          :id="player.player_id"
          :key="player.player_id"
          :player="player"
          :show-volume-control="true"
          :show-menu-button="true"
          :show-sub-players="
            showSubPlayers && player.player_id == store.activePlayerId
          "
          :show-sync-controls="
            player.supported_features.includes(PlayerFeature.SET_MEMBERS)
          "
          @click="playerClicked(player)"
        />
      </v-list>

      <v-expansion-panels
        v-model="selectedPanel"
        variant="accordion"
        flat
        class="expansion"
      >
        <v-expansion-panel style="padding: 0">
          <v-expansion-panel-title
            ><h3>
              {{ $t("all_players") }}
            </h3></v-expansion-panel-title
          >
          <v-expansion-panel-text style="padding: 0">
            <v-list flat style="margin: -20px 3px 5px 3px">
              <PlayerCard
                v-for="player in sortedPlayers.filter(
                  (x) => x.type != PlayerType.GROUP,
                )"
                :id="player.player_id"
                :key="player.player_id"
                :player="player"
                :show-volume-control="true"
                :show-menu-button="true"
                :show-sub-players="
                  showSubPlayers && player.player_id == store.activePlayerId
                "
                :show-sync-controls="
                  player.supported_features.includes(PlayerFeature.SET_MEMBERS)
                "
                @click="playerClicked(player)"
              />
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel
          v-if="sortedPlayers.filter((x) => x.type == PlayerType.GROUP).length"
          style="padding: 0"
        >
          <v-expansion-panel-title
            ><h3>
              {{ $t("all_groups") }}
            </h3></v-expansion-panel-title
          >
          <v-expansion-panel-text style="padding: 0">
            <v-list flat style="margin: -20px 3px 5px 3px">
              <PlayerCard
                v-for="player in sortedPlayers.filter(
                  (x) => x.type == PlayerType.GROUP,
                )"
                :id="player.player_id"
                :key="player.player_id"
                :player="player"
                :show-volume-control="true"
                :show-menu-button="true"
                :show-sub-players="
                  showSubPlayers && player.player_id == store.activePlayerId
                "
                :show-sync-controls="
                  player.supported_features.includes(PlayerFeature.SET_MEMBERS)
                "
                @click="playerClicked(player)"
              />
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  Player,
  PlayerFeature,
  PlayerType,
  PlayerState,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { ConnectionState, api } from "@/plugins/api";
import PlayerCard from "@/components/PlayerCard.vue";
import Button from "@/components/mods/Button.vue";

const showSubPlayers = ref(false);
const selectedPanel = ref<number | null>(null);

// computed properties
const sortedPlayers = computed(() => {
  return Object.values(api.players)
    .filter((x) =>
      // hide synced players or group child's
      playerActive(x, false, false, false),
    )
    .sort((a, b) =>
      a.display_name.toUpperCase() > b.display_name?.toUpperCase() ? 1 : -1,
    );
});

//watchers
watch(
  () => store.activePlayerId,
  (newVal) => {
    if (newVal) {
      // remember last selected playerId
      localStorage.setItem("mass.LastPlayerId", newVal);
    }
  },
);
watch(
  () => api.players,
  (newVal) => {
    if (newVal && !store.activePlayer) {
      checkDefaultPlayer();
    }
  },
  { deep: true },
);
watch(
  () => api.state,
  (newVal) => {
    if (newVal.value != ConnectionState.CONNECTED) {
      store.activePlayerId = undefined;
    }
  },
  { deep: true },
);

function playerClicked(player: Player, close: boolean = false) {
  if (store.activePlayerId == player.player_id) {
    showSubPlayers.value = !showSubPlayers.value;
  } else {
    showSubPlayers.value = false;
    store.activePlayerId = player.player_id;
  }
  if (close) store.showPlayersMenu = false;
}

onMounted(() => {
  checkDefaultPlayer();
});

const playerActive = function (
  player: Player,
  allowUnavailable = true,
  allowSyncChild = false,
  allowHidden = false,
): boolean {
  // perform some basic checks if we may use/show the player
  if (!player.enabled) return false;
  if (!allowHidden && player.hidden) return false;
  if (!allowUnavailable && !player.available) return false;
  if (player.synced_to && !allowSyncChild) return false;
  if (
    !allowSyncChild &&
    player.type == PlayerType.PLAYER &&
    player.active_group
  )
    return false;

  return true;
};

const checkDefaultPlayer = function () {
  if (
    store.activePlayer &&
    playerActive(store.activePlayer, false, false, false)
  )
    return;
  const newDefaultPlayer = selectDefaultPlayer();
  if (newDefaultPlayer) {
    store.activePlayerId = newDefaultPlayer.player_id;
  }
};

const selectDefaultPlayer = function () {
  // check if we have a player stored that was last used
  const lastPlayerId = localStorage.getItem("mass.LastPlayerId");
  if (
    lastPlayerId &&
    lastPlayerId in api.players &&
    playerActive(api.players[lastPlayerId], false, false, false)
  ) {
    return api.players[lastPlayerId];
  }
};
</script>

<style scoped>
.title {
  font-family: "JetBrains Mono Medium";
  font-size: x-large;
  opacity: 0.7;
}
.expansion :deep(.v-expansion-panel-title) {
  padding: 10px 16px;
}
.expansion :deep(.v-expansion-panel-text__wrapper) {
  padding: 10px 5px;
}
</style>
