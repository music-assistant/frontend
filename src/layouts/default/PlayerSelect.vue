<template>
  <!-- players side menu -->
  <v-overlay v-model="store.showPlayersMenu" />
  <v-navigation-drawer
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
      <v-card-title class="title">
        <b>{{ $t("players") }}</b>
      </v-card-title>
      <!-- close button -->
      <Button
        variant="icon"
        style="float: right; top: -40px; height: 0"
        @click="store.showPlayersMenu = false"
      >
        <v-icon size="30">mdi-window-close</v-icon>
      </Button>

      <v-list flat style="margin: 5px 5px">
        <PanelviewPlayerCard
          v-for="player in sortedPlayers.filter((x) => x.powered)"
          :id="player.player_id"
          :key="player.player_id"
          :player="player"
          :show-volume-control="true"
          :show-menu-button="true"
          :show-sub-players="
            showSubPlayers && player.player_id == store.activePlayerId
          "
          :show-sync-controls="
            player.supported_features.includes(PlayerFeature.SYNC)
          "
          @click="playerClicked(player)"
        />
      </v-list>

      <v-expansion-panels variant="accordion" flat class="expansion">
        <v-expansion-panel
          :title="$t('powered_off_players')"
          style="padding: 0"
        >
          <v-expansion-panel-text style="padding: 0">
            <v-list flat>
              <PanelviewPlayerCard
                v-for="player in sortedPlayers.filter((x) => !x.powered)"
                :id="player.player_id"
                :key="player.player_id"
                :player="player"
                :show-volume-control="false"
                :show-menu-button="true"
                :show-sub-players="false"
                :show-sync-controls="false"
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
  PlayerState,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { ConnectionState, api } from "@/plugins/api";
import PanelviewPlayerCard from "@/components/PanelviewPlayerCard.vue";
import Button from "@/components/mods/Button.vue";

const showSubPlayers = ref(false);

// computed properties
const sortedPlayers = computed(() => {
  return (
    Object.values(api.players)
      .filter((x) =>
        // hide synced players or group child's
        playerActive(x, false, false, false),
      )
      .sort((a, b) =>
        a.display_name.toUpperCase() > b.display_name?.toUpperCase() ? 1 : -1,
      )
      // sort by power state - powered players on top
      .sort((a, b) => Number(b.powered) - Number(a.powered))
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
