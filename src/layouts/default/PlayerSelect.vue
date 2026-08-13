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
        :class="[
          'modal-backdrop player-select-backdrop fixed inset-x-0 top-0 z-[997]',
          popoutFromFullscreen
            ? 'player-select-fullscreen-backdrop'
            : store.mobileLayout
              ? 'player-select-mobile-offset'
              : 'player-select-desktop-offset',
        ]"
        :aria-label="$t('close')"
        @click="setMenuOpen(false)"
      ></button>
    </Transition>
  </Teleport>

  <Popover :open="store.showPlayersMenu" @update:open="setMenuOpen">
    <PopoverAnchor :reference="popoutAnchor" />
    <!-- reka-ui generates the panel id and only mounts the panel while it is
         open, so the buttons that open it announce it with
         aria-haspopup/aria-expanded rather than aria-controls. It also names the
         panel after a PopoverTrigger, which this popout has no use for, so the
         panel carries its own label. -->
    <PopoverContent
      data-player-panel
      data-testid="player-select-sheet"
      :aria-label="$t('players')"
      side="top"
      :align="popoutFromFullscreen ? 'center' : 'end'"
      :side-offset="PLAYER_BAR_POPOUT_GAP"
      :collision-padding="PLAYER_BAR_POPOUT_COLLISION_PADDING"
      :class="[
        'player-bar-popout player-select-popover flex flex-col gap-0 overflow-hidden p-0',
        popoutFromFullscreen && 'player-select-popover-fullscreen',
        store.mobileLayout
          ? 'w-[calc(100vw-2*var(--player-bar-popout-gap)-var(--device-inset-left)-var(--device-inset-right))]'
          : 'w-[400px] max-w-[calc(100vw-2*var(--player-bar-popout-gap)-var(--device-inset-left)-var(--device-inset-right))]',
      ]"
      @keydown="handleSheetKeydown"
      @close-auto-focus="preventAutoFocus"
      @open-auto-focus="handleSheetOpenAutoFocus"
      @interact-outside="handleSheetInteractOutside"
    >
      <PanelDragHandle @dismiss="setMenuOpen(false)" />
      <div
        data-panel-drag-region
        class="flex items-center justify-between gap-3 border-b px-4 pt-1 pb-3"
      >
        <div class="flex min-w-0 items-center gap-2">
          <h2 class="truncate text-lg font-semibold">{{ $t("players") }}</h2>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('tooltip.more_options')"
            >
              <EllipsisVertical class="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="z-[100001] min-w-[280px]">
            <DropdownMenuLabel>
              {{ $t("player_select.display_options") }}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              :model-value="showSelectedPlayerFirst"
              @select.prevent
              @update:model-value="
                setBooleanPreference(
                  PLAYER_SELECT_PREFERENCES.showSelectedPlayerFirst,
                  $event,
                )
              "
            >
              {{ $t("player_select.show_selected_player_first") }}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              :model-value="showActivePlayersFirst"
              @select.prevent
              @update:model-value="
                setBooleanPreference(
                  PLAYER_SELECT_PREFERENCES.showActivePlayersFirst,
                  $event,
                )
              "
            >
              {{ $t("player_select.show_active_players_first") }}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              :model-value="showGroupMemberNames"
              @select.prevent
              @update:model-value="
                setBooleanPreference(
                  PLAYER_SELECT_PREFERENCES.showGroupMemberNames,
                  $event,
                )
              "
            >
              {{ $t("player_select.show_grouped_players") }}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              :model-value="showVolumeForActivePlayersOnly"
              @select.prevent
              @update:model-value="
                setBooleanPreference(
                  PLAYER_SELECT_PREFERENCES.showVolumeForActivePlayersOnly,
                  $event,
                )
              "
            >
              {{ $t("player_select.active_player_volume_only") }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <p class="sr-only">{{ $t("tooltip.select_player") }}</p>
      </div>

      <div
        ref="playerList"
        class="player-volume-scroller min-h-0 flex-1 overflow-y-auto pb-6"
      >
        <!-- outranks the selected player badge on the cards scrolling underneath -->
        <div
          v-if="showSearch"
          class="bg-background sticky top-0 z-20 px-3 pt-3 pb-2"
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
            :data-player-id="player.player_id"
            :player="player"
            :show-volume-control="showVolumeControl(player)"
            :show-menu-button="true"
            :show-child-volumes="expandedVolumePlayerIds.has(player.player_id)"
            :show-member-controls="
              expandedMemberPlayerIds.has(player.player_id)
            "
            :show-group-controls="true"
            :show-disabled-group-control="true"
            :show-group-member-names="showGroupMemberNames"
            group-member-layout="subtitle-list"
            :stack-media-details="true"
            :allow-power-control="true"
            :group-control-expanded="
              expandedMemberPlayerIds.has(player.player_id)
            "
            :group-controls-id="getGroupControlsId(player.player_id)"
            :show-selected-indicator="true"
            :player-menu-items="getPlayerManagementMenuItems(player)"
            @click="selectPlayer"
            @toggle-child-volumes="toggleChildVolumes"
            @toggle-member-controls="toggleMemberControls"
          />
        </div>
      </div>
    </PopoverContent>
  </Popover>

  <PlayerRenameDialog
    :open="renameDialogOpen"
    :player="renamePlayer"
    @update:open="setRenameDialogOpen"
  />
</template>

<script setup lang="ts">
import PanelDragHandle from "@/components/PanelDragHandle.vue";
import PlayerCard from "@/components/PlayerCard.vue";
import PlayerRenameDialog from "@/components/PlayerRenameDialog.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import { useOrderedPlayers } from "@/composables/useOrderedPlayers";
import { useUserPreferences } from "@/composables/userPreferences";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  PLAYER_BAR_POPOUT_COLLISION_PADDING,
  PLAYER_BAR_POPOUT_GAP,
  fullscreenPlayerSelectAnchor,
  playerBarEndAnchor,
} from "@/helpers/player_bar";
import { isBuiltinPlayer, isPlayerActive } from "@/helpers/players";
import { api } from "@/plugins/api";
import type { Player } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { CircleOff, EllipsisVertical, Pencil } from "@lucide/vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { toast } from "vue-sonner";

const SEARCH_PLAYER_THRESHOLD = 10;
// Stored instead of a built-in player id: those are unique per browser/app
// session, so they are meaningless on the next visit or on another device.
const BUILTIN_PLAYER_PREFERENCE = "<builtinplayer>";
const PLAYER_SELECT_PREFERENCES = {
  showVolumeForActivePlayersOnly: "playerSelect.showVolumeForActivePlayersOnly",
  showSelectedPlayerFirst: "playerSelect.showSelectedPlayerFirst",
  showActivePlayersFirst: "playerSelect.showActivePlayersFirst",
  showGroupMemberNames: "playerSelect.showGroupMemberNames",
} as const;

const playerSearchQuery = ref("");
const expandedVolumePlayerIds = reactive(new Set<string>());
const expandedMemberPlayerIds = reactive(new Set<string>());
const playerList = ref<HTMLElement>();
const renamePlayer = ref<Player>();
const renameDialogOpen = ref(false);
const { getPreference, setPreference } = useUserPreferences();
const showVolumeForActivePlayersOnly = getPreference<boolean>(
  PLAYER_SELECT_PREFERENCES.showVolumeForActivePlayersOnly,
  true,
);
const showSelectedPlayerFirst = getPreference<boolean>(
  PLAYER_SELECT_PREFERENCES.showSelectedPlayerFirst,
  true,
);
const showActivePlayersFirst = getPreference<boolean>(
  PLAYER_SELECT_PREFERENCES.showActivePlayersFirst,
  true,
);
const showGroupMemberNames = getPreference<boolean>(
  PLAYER_SELECT_PREFERENCES.showGroupMemberNames,
  true,
);
let menuTrigger: HTMLElement | null = null;
let lastInteractionWasKeyboard = false;
let restoreFocusOnClose = false;
let autoSelectedPlayerId: string | undefined;

// PlayerSelect is the only surface that lists needs_setup players: a click here
// launches the setup flow (see selectPlayer) instead of selecting/playing them.
const orderedPlayers = useOrderedPlayers({
  allowNeedsSetup: true,
  selectedPlayerFirst: showSelectedPlayerFirst,
  activePlayersFirst: showActivePlayersFirst,
  includePausedAsActive: true,
});

const showSearch = computed(
  () => orderedPlayers.value.length > SEARCH_PLAYER_THRESHOLD,
);

// the fullscreen player covers the player bar, so the panel pops out of the
// player select button in there and stays on top of it
const popoutFromFullscreen = computed(() => store.showFullscreenPlayer);

const popoutAnchor = computed(() =>
  popoutFromFullscreen.value
    ? fullscreenPlayerSelectAnchor
    : playerBarEndAnchor,
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
      restoreFocusOnClose = lastInteractionWasKeyboard;
      const activeElement = document.activeElement;
      menuTrigger =
        activeElement instanceof HTMLElement && activeElement !== document.body
          ? activeElement
          : null;
      void scrollSelectedPlayerIntoView();
      return;
    }
    resetPanelState();
    nextTick(() => {
      const focusTarget = menuTrigger?.isConnected
        ? menuTrigger
        : document.getElementById("player-select-button");
      if (restoreFocusOnClose) {
        focusTarget?.focus();
      } else {
        focusTarget?.blur();
      }
      menuTrigger = null;
    });
  },
);

watch(showSelectedPlayerFirst, (showFirst) => {
  if (!showFirst && store.showPlayersMenu) {
    void scrollSelectedPlayerIntoView();
  }
});

watch(showSearch, (isVisible) => {
  if (!isVisible) playerSearchQuery.value = "";
});

watch(
  () => store.activePlayerId,
  (playerId) => {
    if (!playerId) return;
    // only a deliberate choice is remembered: persisting the automatic pick
    // would overwrite the player the user actually selected earlier
    if (playerId === autoSelectedPlayerId) return;
    autoSelectedPlayerId = undefined;
    rememberPlayer(playerId);
  },
);

watch(
  () => api.players,
  () => checkDefaultPlayer(),
  { deep: true },
);

watch([() => webPlayer.player_id, () => store.companionPlayerId], () => {
  checkDefaultPlayer();
  preferBuiltinPlayer();
});

onMounted(() => {
  document.addEventListener("keydown", markKeyboardInteraction, true);
  document.addEventListener("pointerdown", markPointerInteraction, true);
  checkDefaultPlayer();
  if (store.showPlayersMenu) void scrollSelectedPlayerIntoView();
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", markKeyboardInteraction, true);
  document.removeEventListener("pointerdown", markPointerInteraction, true);
});

function setMenuOpen(isOpen: boolean) {
  store.showPlayersMenu = isOpen;
}

function handleSheetKeydown(event: KeyboardEvent) {
  event.stopPropagation();
  if (event.key === "Escape") setMenuOpen(false);
}

function handleSheetOpenAutoFocus(event: Event) {
  if (!store.mobileLayout) return;
  event.preventDefault();
  if (event.target instanceof HTMLElement) {
    event.target.focus({ preventScroll: true });
  }
}

function handleSheetInteractOutside(event: Event) {
  const originalEvent = (event as CustomEvent<{ originalEvent?: Event }>).detail
    ?.originalEvent;
  const target = originalEvent?.target;
  if (
    store.dialogActive ||
    (target instanceof Element &&
      target.closest(
        "#player-select-button, [data-slot='dropdown-menu-content']",
      ))
  ) {
    event.preventDefault();
  }
}

function preventAutoFocus(event: Event) {
  event.preventDefault();
}

function setBooleanPreference(
  key: (typeof PLAYER_SELECT_PREFERENCES)[keyof typeof PLAYER_SELECT_PREFERENCES],
  value: boolean | "indeterminate",
) {
  if (typeof value === "boolean") void setPreference(key, value);
}

function markKeyboardInteraction() {
  lastInteractionWasKeyboard = true;
}

function markPointerInteraction() {
  lastInteractionWasKeyboard = false;
}

function selectPlayer(player: Player) {
  if (player.needs_setup) {
    // a player that still needs setup can't be selected; launch its setup flow instead
    eventbus.emit("setupFlowDialog", {
      kind: "player",
      playerId: player.player_id,
    });
    store.showPlayersMenu = false;
    return;
  }
  // remember it here as well: picking the player that was already selected
  // automatically leaves store.activePlayerId untouched
  autoSelectedPlayerId = undefined;
  rememberPlayer(player.player_id);
  store.activePlayerId = player.player_id;
  store.showPlayersMenu = false;
}

function showVolumeControl(player: Player) {
  return !showVolumeForActivePlayersOnly.value || isPlayerActive(player);
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

function toggleExpandedPlayer(playerIds: Set<string>, playerId: string) {
  if (playerIds.has(playerId)) {
    playerIds.delete(playerId);
  } else {
    playerIds.add(playerId);
  }
}

function getGroupControlsId(playerId: string) {
  return `player-select-group-${encodeURIComponent(playerId)}`;
}

function getPlayerManagementMenuItems(player: Player): ContextMenuItem[] {
  if (!authManager.isAdmin()) return [];

  return [
    {
      label: "player_select.rename_player",
      action: () => {
        closeMenuThen(() => {
          renamePlayer.value = player;
          renameDialogOpen.value = true;
        });
      },
      icon: Pencil,
    },
    {
      label: "player_select.disable_player",
      action: () => confirmDisablePlayer(player),
      icon: CircleOff,
      color: "error",
    },
  ];
}

function confirmDisablePlayer(player: Player) {
  closeMenuThen(() => {
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("player_select.disable_player_title", [player.name]),
      message: $t("player_select.disable_player_confirmation"),
      confirmLabel: $t("settings.disable"),
      onConfirm: () => disablePlayer(player),
    });
  });
}

function closeMenuThen(action: () => void) {
  setMenuOpen(false);
  window.setTimeout(action, 0);
}

async function disablePlayer(player: Player) {
  const fallbackPlayer = orderedPlayers.value.find(
    (candidate) =>
      candidate.player_id !== player.player_id &&
      candidate.available &&
      !candidate.needs_setup,
  );

  try {
    await api.savePlayerConfig(player.player_id, { enabled: false });
    if (api.players[player.player_id]) {
      api.players[player.player_id].enabled = false;
    }
    if (store.activePlayerId === player.player_id) {
      store.activePlayerId = fallbackPlayer?.player_id;
      if (!fallbackPlayer) {
        await setPreference("activePlayerId", null);
      }
    }
    toast.success($t("settings.player_saved"));
  } catch (error) {
    toast.error(String(error));
  }
}

function setRenameDialogOpen(open: boolean) {
  renameDialogOpen.value = open;
  if (!open) renamePlayer.value = undefined;
}

function resetPanelState() {
  playerSearchQuery.value = "";
  expandedVolumePlayerIds.clear();
  expandedMemberPlayerIds.clear();
}

function checkDefaultPlayer() {
  if (store.activePlayer) return;
  const defaultPlayerId = selectDefaultPlayer();
  if (!defaultPlayerId) return;
  autoSelectedPlayerId = defaultPlayerId;
  store.activePlayerId = defaultPlayerId;
  // a built-in player id remembered before the placeholder existed only
  // resolves in the browser session that created it: store the placeholder
  if (getPreference<string>("activePlayerId").value === defaultPlayerId) {
    rememberPlayer(defaultPlayerId);
  }
}

/**
 * Hand an automatically picked player over to the built-in player of this
 * device, which only registers a moment after the app has started.
 */
function preferBuiltinPlayer() {
  if (store.activePlayerId !== autoSelectedPlayerId) return;
  if (getPreference<string>("activePlayerId").value) return;
  const builtinPlayerId = selectBuiltinPlayer();
  if (!builtinPlayerId) return;
  autoSelectedPlayerId = builtinPlayerId;
  store.activePlayerId = builtinPlayerId;
}

function rememberPlayer(playerId: string) {
  const player = api.players[playerId];
  if (!player) return;
  const rememberedPlayer = isBuiltinPlayer(player)
    ? BUILTIN_PLAYER_PREFERENCE
    : playerId;
  if (getPreference<string>("activePlayerId").value === rememberedPlayer)
    return;
  void setPreference("activePlayerId", rememberedPlayer);
}

function selectDefaultPlayer() {
  const lastPlayerId = getPreference<string>("activePlayerId").value;
  // both a remembered built-in player and a remembered player that is not known
  // (yet) register a moment after startup, so leave the selection empty until
  // they show up instead of settling for another player
  if (lastPlayerId === BUILTIN_PLAYER_PREFERENCE) return selectBuiltinPlayer();
  if (lastPlayerId) {
    if (!(lastPlayerId in api.players)) return;
    if (isSelectablePlayer(lastPlayerId)) return lastPlayerId;
  }
  const builtinPlayerId = selectBuiltinPlayer();
  if (builtinPlayerId) return builtinPlayerId;
  const selectablePlayers = orderedPlayers.value.filter((player) =>
    isSelectablePlayer(player.player_id),
  );
  return (selectablePlayers.find(isPlayerActive) ?? selectablePlayers[0])
    ?.player_id;
}

function selectBuiltinPlayer() {
  if (isSelectablePlayer(webPlayer.player_id)) {
    return webPlayer.player_id;
  }
  if (isSelectablePlayer(store.companionPlayerId)) {
    return store.companionPlayerId;
  }
}

function isSelectablePlayer(playerId: string | null | undefined) {
  if (!playerId) return false;
  const player = api.players[playerId];
  return player?.enabled && player.available && !player.needs_setup;
}

async function scrollSelectedPlayerIntoView() {
  if (showSelectedPlayerFirst.value || !store.showPlayersMenu) {
    return;
  }

  await nextTick();
  const activePlayerId = store.activePlayerId;
  if (!activePlayerId) return;

  const activePlayerElement = Array.from(
    playerList.value?.querySelectorAll<HTMLElement>("[data-player-id]") ?? [],
  ).find((element) => element.dataset.playerId === activePlayerId);
  activePlayerElement?.scrollIntoView?.({ block: "nearest" });
}
</script>

<style>
.player-select-desktop-offset {
  bottom: var(--bottom-bars-height) !important;
}

.player-select-mobile-offset {
  bottom: var(--mobile-navigation-height) !important;
}

/* the paired class outweighs the equally-!important z-index utility the popover
   component carries */
.player-bar-popout.player-select-popover {
  z-index: 998 !important;
}

/* the fullscreen player is a dialog at z-index 9000, so both the panel and its
   backdrop have to clear it; each rule pairs up its class to outweigh the
   utility it overrides */
.player-select-backdrop.player-select-fullscreen-backdrop {
  bottom: 0 !important;
  z-index: 9001 !important;
}

.player-bar-popout.player-select-popover.player-select-popover-fullscreen {
  z-index: 9002 !important;
}

/* the fullscreen player covers the mobile player bar, so this popout has no
   floating bar to stay clear of */
:root[data-player-bar-overlay]
  .player-bar-popout.player-select-popover-fullscreen {
  padding-bottom: 0 !important;
}
</style>
