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
    :width="460"
    style="z-index: 99999"
    z-index="99999"
    color="background"
  >
    <div>
      <!-- heading with Players as title-->
      <v-card-title
        class="title"
        style="padding-top: 20px; padding-bottom: 20px"
      >
        <b>{{ $t("players") }}</b>
        <div style="float: right; margin-right: -20px">
          <!-- settings button (admin only) -->
          <Button
            v-if="authManager.isAdmin()"
            variant="icon"
            :to="{ name: 'playersettings' }"
          >
            <v-icon size="30">mdi-cog-outline</v-icon>
          </Button>
          <!-- close button -->
          <Button variant="icon" @click="store.showPlayersMenu = false">
            <v-icon size="30">mdi-window-close</v-icon>
          </Button>
        </div>
      </v-card-title>

      <v-divider />

      <v-list flat style="margin: 0px 10px; padding: 0">
        <!-- active/playing players on top -->
        <PlayerCard
          v-for="player in sortedPlayers.filter(
            (x) =>
              [PlaybackState.PLAYING, PlaybackState.PAUSED].includes(
                x.playback_state!,
              ) ||
              (api.queues[x.player_id]?.items > 0 && x.powered != false) ||
              webPlayer.player_id === x.player_id,
          )"
          :id="player.player_id"
          :key="player.player_id"
          style="margin: 10px 0px"
          :player="player"
          :show-volume-control="true"
          :show-menu-button="true"
          :show-sub-players="
            showSubPlayers && player.player_id == store.activePlayerId
          "
          :show-sync-controls="
            player.supported_features.includes(PlayerFeature.SET_MEMBERS)
          "
          :allow-power-control="true"
          @click="playerClicked(player)"
          @toggle-expand="toggleGroupExpand"
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
                style="margin: 5px 0px"
                :player="player"
                :show-volume-control="true"
                :show-menu-button="true"
                :show-sub-players="
                  showSubPlayers && player.player_id == store.activePlayerId
                "
                :show-sync-controls="
                  player.supported_features.includes(PlayerFeature.SET_MEMBERS)
                "
                :allow-power-control="true"
                @click="playerClicked(player)"
                @toggle-expand="toggleGroupExpand"
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
                style="margin: 5px 0px"
                :player="player"
                :show-volume-control="true"
                :show-menu-button="true"
                :show-sub-players="
                  showSubPlayers && player.player_id == store.activePlayerId
                "
                :show-sync-controls="
                  player.supported_features.includes(PlayerFeature.SET_MEMBERS)
                "
                :allow-power-control="true"
                @click="playerClicked(player)"
                @toggle-expand="toggleGroupExpand"
              />
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import PlayerCard from "@/components/PlayerCard.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { playerVisible } from "@/helpers/utils";
import { api, ConnectionState } from "@/plugins/api";
import {
  PlaybackState,
  Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { isPlaybackMode, webPlayer } from "@/plugins/web_player";
import { computed, onMounted, ref, watch } from "vue";

const showSubPlayers = ref(false);
const selectedPanel = ref<number | null>(null);
const { getPreference, setPreference } = useUserPreferences();

// computed properties
const sortedPlayers = computed(() => {
  return Object.values(api.players)
    .filter((x) => playerVisible(x))
    .sort((a, b) => (a.name.toUpperCase() > b.name?.toUpperCase() ? 1 : -1));
});

//watchers
watch(
  () => store.activePlayerId,
  (newVal) => {
    if (newVal) {
      // remember last selected playerId
      setPreference("activePlayerId", newVal);
      localStorage.setItem("activePlayerId", newVal);
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
  if (store.activePlayerId !== player.player_id) {
    store.activePlayerId = player.player_id;
  }
  if (close) store.showPlayersMenu = false;
}

function toggleGroupExpand(player: Player) {
  if (store.activePlayerId !== player.player_id) {
    store.activePlayerId = player.player_id;
    showSubPlayers.value = true;
  } else {
    showSubPlayers.value = !showSubPlayers.value;
  }
}

onMounted(() => {
  checkDefaultPlayer();
});

const checkDefaultPlayer = function () {
  if (store.activePlayer && playerVisible(store.activePlayer)) return;
  const newDefaultPlayerId = selectDefaultPlayer();
  if (newDefaultPlayerId) {
    store.activePlayerId = newDefaultPlayerId;
  }
};

const selectDefaultPlayer = function () {
  // check if we have a player stored that was last used
  // we prefer localStorage over user preferences to allow having a prefered
  // player per device - especially useful in case of using the built-in web player
  const lastPlayerId =
    localStorage.getItem("activePlayerId") ||
    getPreference<string>("activePlayerId").value;
  if (
    lastPlayerId &&
    lastPlayerId in api.players &&
    api.players[lastPlayerId].available
  ) {
    return lastPlayerId;
  }
  if (!lastPlayerId && webPlayer.player_id) {
    return webPlayer.player_id;
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
