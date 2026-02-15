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
    <!-- heading with Players as title - fixed at top -->
    <template #prepend>
      <v-card-title
        class="title"
        style="padding-top: 20px; padding-bottom: 20px"
      >
        <b>{{ $t("players") }}</b>
        <div style="float: right">
          <!-- settings button (admin only) -->
          <Button
            v-if="authManager.isAdmin()"
            variant="icon"
            :to="{ name: 'playersettings' }"
          >
            <v-icon size="24">mdi-cog</v-icon>
          </Button>
          <!-- close button -->
          <Button variant="icon" @click="store.showPlayersMenu = false">
            <v-icon size="24">mdi-close</v-icon>
          </Button>
        </div>
      </v-card-title>
      <v-divider />
    </template>

    <!-- scrollable content -->
    <div class="player-content">
      <!-- preferred/active players on top -->
      <v-list flat style="margin: 0px 10px; padding: 0">
        <PlayerCard
          v-for="player in preferredPlayers"
          :id="player.player_id"
          :key="player.player_id"
          style="margin: 10px 0px"
          :player="player"
          :show-volume-control="true"
          :show-menu-button="true"
          :show-sub-players="
            showSubPlayers && player.player_id == store.activePlayerId
          "
          :show-sync-controls="true"
          :allow-power-control="true"
          @click="playerClicked(player)"
          @toggle-expand="toggleGroupExpand"
        />
      </v-list>

      <!-- collapsible section with all players (only shown if more than 3 players) -->
      <v-expansion-panels
        v-if="allPlayers.length > 3"
        v-model="allPlayersExpanded"
        variant="accordion"
        flat
        class="expansion"
      >
        <v-expansion-panel style="padding: 0">
          <v-expansion-panel-title>
            <h3>{{ $t("all_players") }}</h3>
          </v-expansion-panel-title>
          <v-expansion-panel-text style="padding: 0">
            <div style="margin: 0 8px 24px 8px">
              <InputGroup>
                <InputGroupInput
                  ref="playerSearchInput"
                  v-model="playerSearchQuery"
                  :placeholder="$t('search')"
                />
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
              </InputGroup>
            </div>
            <v-list flat style="margin: -20px 3px 5px 3px">
              <PlayerCard
                v-for="player in filteredPlayers"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useUserPreferences } from "@/composables/userPreferences";
import { playerVisible } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { PlaybackState, Player, PlayerFeature } from "@/plugins/api/interfaces";

import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { Search } from "lucide-vue-next";
import { computed, nextTick, onMounted, ref, watch } from "vue";

const showSubPlayers = ref(false);
const recentlySelectedPlayerIds = ref<string[]>([]);
const playerSortOrder = ref<string[]>([]);
const allPlayersExpanded = ref<number | undefined>(undefined);
const playerSearchQuery = ref("");
const playerSearchInput = ref<InstanceType<typeof InputGroupInput> | null>(
  null,
);
const { getPreference, setPreference } = useUserPreferences();

const MAX_RECENT_PLAYERS = 3;

// Load all players expanded state from user preferences
const allPlayersExpandedPref = getPreference<boolean>("allPlayersExpanded");
watch(
  allPlayersExpandedPref,
  (newVal) => {
    // v-expansion-panels uses 0 for expanded, undefined for collapsed
    allPlayersExpanded.value = newVal ? 0 : undefined;
  },
  { immediate: true },
);

// Save expanded state when it changes
watch(allPlayersExpanded, (newVal) => {
  setPreference("allPlayersExpanded", newVal === 0);
});

// Load recently selected players from user preferences (only on initial load)
const recentPlayersPref = getPreference<string[]>("recentlySelectedPlayerIds");
if (recentPlayersPref.value) {
  recentlySelectedPlayerIds.value = recentPlayersPref.value;
}

// Calculate priority score for a player
const getPlayerPriority = (player: Player): number => {
  let score = 0;

  // Playing or paused = 2 points
  if (
    player.playback_state === PlaybackState.PLAYING ||
    player.playback_state === PlaybackState.PAUSED
  ) {
    score += 2;
  }

  // "This device" web/companion player = 2 points
  if (
    player.player_id === webPlayer.player_id ||
    player.player_id === store.companionPlayerId
  ) {
    score += 2;
  }

  // Has current_media = 1 point
  if (player.current_media) {
    score += 1;
  }

  // Recently selected: 3 points for most recent, 2 for second, 1 for third
  const recentIndex = recentlySelectedPlayerIds.value.indexOf(player.player_id);
  if (recentIndex !== -1) {
    score += MAX_RECENT_PLAYERS - recentIndex;
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
const allPlayers = computed(() => {
  return Object.values(api.players)
    .filter((x) => playerVisible(x))
    .sort((a, b) => (a.name.toUpperCase() > b.name?.toUpperCase() ? 1 : -1));
});

// Filtered players based on search query
const filteredPlayers = computed(() => {
  if (playerSearchQuery.value) {
    // When searching, show all matching players
    const query = playerSearchQuery.value.toLowerCase();
    return allPlayers.value.filter((p) => p.name.toLowerCase().includes(query));
  }
  // When not searching, exclude players already shown in preferred section
  const preferredIds = preferredPlayers.value.map((p) => p.player_id);
  return allPlayers.value.filter((p) => !preferredIds.includes(p.player_id));
});

// Show search box when there are more than 8 players
const showPlayerSearch = computed(() => allPlayers.value.length > 8);

// Preferred players shown at top (playing, active, recently selected, web player)
const preferredPlayers = computed(() => {
  const players = Object.values(api.players).filter((x) => playerVisible(x));
  if (players.length <= 3) {
    // If 3 or fewer players, show all as preferred
    return players.sort((a, b) => {
      const indexA = playerSortOrder.value.indexOf(a.player_id);
      const indexB = playerSortOrder.value.indexOf(b.player_id);
      return indexA - indexB;
    });
  }
  // Filter to only players with priority > 0, then sort by frozen order, limit to top 3
  const preferred = players.filter((p) => getPlayerPriority(p) > 0);
  return preferred
    .sort((a, b) => {
      const indexA = playerSortOrder.value.indexOf(a.player_id);
      const indexB = playerSortOrder.value.indexOf(b.player_id);
      return indexA - indexB;
    })
    .slice(0, 3);
});

//watchers
watch(
  () => store.showPlayersMenu,
  (newVal) => {
    if (newVal) {
      // Calculate sort order when menu opens
      calculateSortOrder();
      nextTick(() => {
        if (allPlayersExpanded.value === 0) {
          playerSearchInput.value?.focus?.();
        }
      });
    } else {
      // Save preferences and reset state when menu closes
      playerSearchQuery.value = "";
      if (store.activePlayerId) {
        setPreference("activePlayerId", store.activePlayerId);
        localStorage.setItem("activePlayerId", store.activePlayerId);
        // Update recently selected players list
        const recent = recentlySelectedPlayerIds.value.filter(
          (id) => id !== store.activePlayerId,
        );
        recent.unshift(store.activePlayerId);
        recentlySelectedPlayerIds.value = recent.slice(0, MAX_RECENT_PLAYERS);
      }
      setPreference(
        "recentlySelectedPlayerIds",
        recentlySelectedPlayerIds.value,
      );
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
    store.playerTipShown = true;
  }
  if (close) store.showPlayersMenu = false;
  // Scroll the player card into view (use nearest to avoid hiding header)
  nextTick(() => {
    const element = document.getElementById(player.player_id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

function toggleGroupExpand(player: Player) {
  if (store.activePlayerId !== player.player_id) {
    store.activePlayerId = player.player_id;
    showSubPlayers.value = true;
  } else {
    showSubPlayers.value = !showSubPlayers.value;
  }
  // Scroll the player card into view when expanding (use nearest to avoid hiding header)
  if (showSubPlayers.value) {
    nextTick(() => {
      const element = document.getElementById(player.player_id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
}

onMounted(() => {
  checkDefaultPlayer();
});

const checkDefaultPlayer = function () {
  if (store.activePlayer) return;
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
  if (lastPlayerId && lastPlayerId in api.players) {
    return lastPlayerId;
  }
  // select webPlayer if available (only if we do not have a previous player stored)
  if (
    !lastPlayerId &&
    webPlayer.player_id &&
    webPlayer.player_id in api.players
  ) {
    return webPlayer.player_id;
  }
  // select companionPlayer if available (only if we do not have a previous player stored)
  if (
    !lastPlayerId &&
    store.companionPlayerId &&
    store.companionPlayerId in api.players
  ) {
    return store.companionPlayerId;
  }
};
</script>

<style scoped>
.title {
  font-family: "JetBrains Mono Medium";
  font-size: x-large;
  opacity: 0.7;
}
.player-content {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.expansion :deep(.v-expansion-panel-title) {
  padding: 10px 16px;
}
.expansion :deep(.v-expansion-panel-text__wrapper) {
  padding: 10px 5px;
}
</style>
