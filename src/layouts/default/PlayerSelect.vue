<template>
  <!-- Overlay scrim (used when panel overlays content instead of being inline) -->
  <Transition name="player-scrim">
    <div
      v-if="!useInlinePanel && store.showPlayersMenu"
      class="player-panel-scrim"
      @click="store.showPlayersMenu = false"
    ></div>
  </Transition>

  <!-- Inline spacer: only on wide screens, transitions width to push main content -->
  <div
    v-if="useInlinePanel"
    class="player-panel-spacer"
    :class="{ 'player-panel-spacer--open': store.showPlayersMenu }"
  ></div>

  <!-- Panel: fixed position, slides in via transform -->
  <div
    class="player-panel"
    :class="{
      'player-panel--open': store.showPlayersMenu,
      'player-panel--overlay': !useInlinePanel,
    }"
  >
    <div class="player-panel-inner">
      <!-- header -->
      <div class="player-header">
        <Speaker class="player-header-icon" />
        <span class="player-header-title">{{ $t("players") }}</span>
      </div>

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
                    player.supported_features.includes(
                      PlayerFeature.SET_MEMBERS,
                    )
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
    </div>
  </div>
</template>

<script setup lang="ts">
import PlayerCard from "@/components/PlayerCard.vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useUserPreferences } from "@/composables/userPreferences";
import { playerVisible } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { Player, PlayerFeature } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";

import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { Search, Speaker } from "lucide-vue-next";
import { computed, nextTick, onMounted, ref, watch } from "vue";

// Wide screens (>=1100px): inline sidebar that pushes content.
// Narrower screens & mobile: overlay panel with scrim.
const useInlinePanel = computed(
  () => !store.mobileLayout && getBreakpointValue("bp7"),
);

const showSubPlayers = ref(false);
const recentlySelectedPlayerIds = ref<string[]>([]);
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

// Preferred players shown at top (last 3 recently selected players)
const preferredPlayers = computed(() => {
  const players = Object.values(api.players).filter((x) => playerVisible(x));
  if (players.length <= 3) {
    // If 3 or fewer players, show all sorted alphabetically
    return players.sort((a, b) =>
      a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1,
    );
  }
  // Show only recently selected players that still exist
  const recentPlayers = recentlySelectedPlayerIds.value
    .map((id) => players.find((p) => p.player_id === id))
    .filter((p): p is Player => p !== undefined)
    .slice(0, MAX_RECENT_PLAYERS);
  return recentPlayers;
});

//watchers
watch(
  () => store.showPlayersMenu,
  (newVal) => {
    if (!newVal) {
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
  // we prefer localStorage over user preferences to allow having a preferred
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
/*
 * Desktop spacer: transparent div in the flex layout.
 * Smoothly transitions width to push main content, just like AppSidebar.
 */
.player-panel-spacer {
  width: 0;
  flex-shrink: 0;
  transition: width 0.2s ease-linear;
}

.player-panel-spacer--open {
  width: 400px;
}

/*
 * Panel: fixed position, slides via GPU-accelerated transform.
 * Content is never clipped — the spacer handles the layout shift separately.
 */
.player-panel {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  width: 400px;
  z-index: 10;
  transform: translateX(100%);
  transition: transform 0.5s;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border-left: 1px solid rgba(var(--v-border-color), 0.12);
  display: flex;
  flex-direction: column;
}

.player-panel--open {
  transform: translateX(0);
}

/*
 * Overlay mode: narrower screens & mobile. Higher z-index, covers content.
 * On mobile (mobileLayout) it's 85vw; on mid-width desktops it stays 400px.
 */
.player-panel--overlay {
  z-index: 99999;
  border-left: none;
}

@media (max-width: 769px) {
  .player-panel--overlay {
    width: 90vw;
    height: calc(100% - 60px);
  }
}

/* Inner wrapper */
.player-panel-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Mobile scrim/overlay */
.player-panel-scrim {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.5);
}

.player-scrim-enter-active,
.player-scrim-leave-active {
  transition: opacity 0.2s ease;
}

.player-scrim-enter-from,
.player-scrim-leave-to {
  opacity: 0;
}

/* Header */
.player-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  padding-bottom: 8px;
  padding-left: 16px;
  flex-shrink: 0;
}

.player-header-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  opacity: 0.7;
}

.player-header-title {
  font-size: 1.1rem;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
}

/* Scrollable content */
.player-content {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  min-height: 0;
  padding-bottom: 100px;
}

/* Force Vuetify children to inherit the panel background */
.player-content :deep(.v-list),
.player-content :deep(.v-expansion-panels),
.player-content :deep(.v-expansion-panel),
.player-content :deep(.v-expansion-panel-title),
.player-content :deep(.v-expansion-panel-text) {
  background: transparent !important;
}

.expansion :deep(.v-expansion-panel-title) {
  padding: 10px 16px;
}

.expansion :deep(.v-expansion-panel-text__wrapper) {
  padding: 10px 5px;
}
</style>
