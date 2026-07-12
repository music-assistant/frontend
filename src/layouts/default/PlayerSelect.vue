<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <button
        v-if="store.showPlayersMenu"
        type="button"
        class="player-select-backdrop fixed inset-x-0 top-0 bottom-[60px] z-[99999] bg-black/60 backdrop-blur-sm md:bottom-0"
        :aria-label="$t('close')"
        @click="setMenuOpen(false)"
      ></button>
    </Transition>
  </Teleport>

  <Sheet
    :open="store.showPlayersMenu"
    :modal="false"
    @update:open="setMenuOpen"
  >
    <SheetContent
      data-testid="player-select-sheet"
      side="right"
      class="w-[90vw] gap-0 p-0 sm:max-w-[400px] max-md:bottom-[60px]"
      @keydown="handleSheetKeydown"
    >
      <SheetHeader class="flex-row items-center gap-2 border-b pr-14">
        <Speaker class="size-5 text-muted-foreground" />
        <SheetTitle class="text-lg">{{ $t("players") }}</SheetTitle>
        <SheetDescription class="sr-only">
          {{ $t("tooltip.select_player") }}
        </SheetDescription>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto pb-6">
        <div
          v-if="showSearch"
          class="bg-background sticky top-0 z-10 px-3 pt-3 pb-2"
        >
          <SearchInput
            v-model="playerSearchQuery"
            :placeholder="$t('search')"
            clearable
          />
        </div>

        <div class="space-y-2 px-3 pt-3">
          <p
            v-if="filteredPlayers.length === 0"
            class="text-muted-foreground px-3 py-8 text-center text-sm"
          >
            {{ playerSearchQuery ? $t("no_content_filter") : $t("no_content") }}
          </p>
          <PlayerCard
            v-for="player in filteredPlayers"
            :id="player.player_id"
            :key="player.player_id"
            :player="player"
            :show-volume-control="true"
            :show-menu-button="true"
            :show-child-volumes="expandedVolumePlayerIds.has(player.player_id)"
            :show-member-controls="
              expandedMemberPlayerIds.has(player.player_id)
            "
            :show-group-controls="true"
            :allow-power-control="true"
            @click="selectPlayer"
            @toggle-child-volumes="toggleChildVolumes"
            @toggle-member-controls="toggleMemberControls"
          />
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import PlayerCard from "@/components/PlayerCard.vue";
import { SearchInput } from "@/components/ui/search-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUserPreferences } from "@/composables/userPreferences";
import { isBuiltinPlayer, playerVisible } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { PlaybackState, type Player } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { Speaker } from "@lucide/vue";
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";

const SEARCH_PLAYER_THRESHOLD = 10;

const playerSearchQuery = ref("");
const expandedVolumePlayerIds = reactive(new Set<string>());
const expandedMemberPlayerIds = reactive(new Set<string>());
const { getPreference, setPreference } = useUserPreferences();
let menuTrigger: HTMLElement | null = null;

const players = computed(() =>
  Object.values(api.players).filter((player) => playerVisible(player)),
);

const orderedPlayers = computed(() =>
  [...players.value].sort((left, right) => {
    const leftPriority = getPlayerPriority(left);
    const rightPriority = getPlayerPriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  }),
);

const showSearch = computed(
  () => players.value.length > SEARCH_PLAYER_THRESHOLD,
);

const filteredPlayers = computed(() => {
  if (!showSearch.value) return orderedPlayers.value;
  const query = playerSearchQuery.value.trim().toLocaleLowerCase();
  if (!query) return orderedPlayers.value;
  return orderedPlayers.value.filter((player) =>
    player.name.toLocaleLowerCase().includes(query),
  );
});

watch(
  () => store.showPlayersMenu,
  (isOpen) => {
    if (isOpen) {
      const activeElement = document.activeElement;
      menuTrigger =
        activeElement instanceof HTMLElement && activeElement !== document.body
          ? activeElement
          : null;
      return;
    }
    resetPanelState();
    nextTick(() => {
      const focusTarget = menuTrigger?.isConnected
        ? menuTrigger
        : (document.getElementById("active-player-popover") ??
          document.getElementById("extended-controls-speaker-button"));
      focusTarget?.focus();
      menuTrigger = null;
    });
  },
);

watch(showSearch, (isVisible) => {
  if (!isVisible) playerSearchQuery.value = "";
});

watch(
  () => store.activePlayerId,
  (playerId) => {
    if (!playerId) return;
    setPreference("activePlayerId", playerId);
    localStorage.setItem("activePlayerId", playerId);
  },
);

watch(
  () => api.players,
  () => checkDefaultPlayer(),
  { deep: true },
);

watch(
  () => webPlayer.player_id,
  () => checkDefaultPlayer(),
);

onMounted(() => {
  checkDefaultPlayer();
});

function setMenuOpen(isOpen: boolean) {
  store.showPlayersMenu = isOpen;
}

function handleSheetKeydown(event: KeyboardEvent) {
  event.stopPropagation();
  if (event.key === "Escape") setMenuOpen(false);
}

function selectPlayer(player: Player) {
  store.activePlayerId = player.player_id;
  store.showPlayersMenu = false;
}

function toggleChildVolumes(player: Player) {
  const playerId = player.player_id;
  expandedMemberPlayerIds.delete(playerId);
  toggleExpandedPlayer(expandedVolumePlayerIds, playerId);
}

function toggleMemberControls(player: Player) {
  const playerId = player.player_id;
  expandedVolumePlayerIds.delete(playerId);
  toggleExpandedPlayer(expandedMemberPlayerIds, playerId);
}

function getPlayerPriority(player: Player) {
  if (player.player_id === store.activePlayerId) return 0;
  if (isBuiltinPlayer(player)) return 1;
  if (player.playback_state === PlaybackState.PLAYING) return 2;
  return 3;
}

function toggleExpandedPlayer(playerIds: Set<string>, playerId: string) {
  if (playerIds.has(playerId)) {
    playerIds.delete(playerId);
  } else {
    playerIds.add(playerId);
  }
}

function resetPanelState() {
  playerSearchQuery.value = "";
  expandedVolumePlayerIds.clear();
  expandedMemberPlayerIds.clear();
}

function checkDefaultPlayer() {
  if (store.activePlayer) return;
  const defaultPlayerId = selectDefaultPlayer();
  if (defaultPlayerId) {
    store.activePlayerId = defaultPlayerId;
  }
}

function selectDefaultPlayer() {
  const lastPlayerId =
    localStorage.getItem("activePlayerId") ||
    getPreference<string>("activePlayerId").value;
  if (lastPlayerId && lastPlayerId in api.players) {
    return lastPlayerId;
  }
  if (
    !lastPlayerId &&
    webPlayer.player_id &&
    webPlayer.player_id in api.players
  ) {
    return webPlayer.player_id;
  }
  if (
    !lastPlayerId &&
    store.companionPlayerId &&
    store.companionPlayerId in api.players
  ) {
    return store.companionPlayerId;
  }
}
</script>
