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
        <PlayerCard
          v-for="player in sortedPlayers"
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
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import PlayerCard from "@/components/PlayerCard.vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { playerVisible } from "@/helpers/utils";
import { PlaybackState, Player, PlayerFeature } from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";

import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { computed, onMounted, ref, watch } from "vue";

const showSubPlayers = ref(false);
const recentlySelectedPlayerIds = ref<string[]>([]);
const playerSortOrder = ref<string[]>([]);
const { getPreference, setPreference } = useUserPreferences();

const MAX_RECENT_PLAYERS = 3;

// Load recently selected players from user preferences
const recentPlayersPref = getPreference<string[]>("recentlySelectedPlayerIds");
watch(
  recentPlayersPref,
  (newVal) => {
    recentlySelectedPlayerIds.value = newVal || [];
  },
  { immediate: true },
);

// Calculate priority score for a player
const getPlayerPriority = (player: Player): number => {
  let score = 0;

  // Playing or paused = 5 points
  if (
    player.playback_state === PlaybackState.PLAYING ||
    player.playback_state === PlaybackState.PAUSED
  ) {
    score += 5;
  }

  // Active player in store = 1 points
  if (player.player_id === store.activePlayerId) {
    score += 1;
  }

  // "This device" web player = 3 points
  if (player.player_id === webPlayer.player_id) {
    score += 3;
  }

  // Has current_media = 1 point
  if (player.current_media) {
    score += 1;
  }

  // Recently selected (last 3) = 1 point
  if (recentlySelectedPlayerIds.value.includes(player.player_id)) {
    score += 1;
  }

  return score;
};

// Calculate sort order once when menu opens (snapshot of priorities)
const calculateSortOrder = () => {
  const players = Object.values(api.players).filter((x) => playerVisible(x));
  const sorted = players.sort((a, b) => {
    const priorityA = getPlayerPriority(a);
    const priorityB = getPlayerPriority(b);
    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }
    return a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1;
  });
  playerSortOrder.value = sorted.map((p) => p.player_id);
};

// computed properties
const sortedPlayers = computed(() => {
  const players = Object.values(api.players).filter((x) => playerVisible(x));
  // Sort based on the frozen sort order, with new players at the end
  return players.sort((a, b) => {
    const indexA = playerSortOrder.value.indexOf(a.player_id);
    const indexB = playerSortOrder.value.indexOf(b.player_id);
    // Players not in sort order go to the end, sorted alphabetically
    if (indexA === -1 && indexB === -1) {
      return a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1;
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
});

//watchers
watch(
  () => store.showPlayersMenu,
  (newVal) => {
    if (newVal) {
      // Calculate sort order when menu opens
      calculateSortOrder();
    } else {
      // Save preferences when menu closes
      if (store.activePlayerId) {
        setPreference("activePlayerId", store.activePlayerId);
        localStorage.setItem("activePlayerId", store.activePlayerId);
      }
      setPreference(
        "recentlySelectedPlayerIds",
        recentlySelectedPlayerIds.value,
      );
    }
  },
);
watch(
  () => store.activePlayerId,
  (newVal) => {
    if (newVal) {
      // Track recently selected players (last 3) - saved when menu closes
      const recent = recentlySelectedPlayerIds.value.filter(
        (id) => id !== newVal,
      );
      recent.unshift(newVal);
      recentlySelectedPlayerIds.value = recent.slice(0, MAX_RECENT_PLAYERS);
    }
  },
);
watch(
  () => api.players,
  (newVal) => {
    if (newVal) {
      checkDefaultPlayer();
    }
  },
  { deep: true },
);

watch(
  () => webPlayer.player_id,
  (newVal) => {
    if (newVal) {
      checkDefaultPlayer();
    }
  },
);

function playerClicked(player: Player, close: boolean = false) {
  if (store.activePlayerId !== player.player_id) {
    store.activePlayerId = player.player_id;
    store.playMenuShown = true;
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
  if (webPlayer.player_id) {
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
</style>
