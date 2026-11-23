import { useUserPreferences } from "@/composables/userPreferences";
import {
  getListedPlayerConfigs,
  getPlayerName,
  playerBelongsToProviders,
} from "@/helpers/player_config";
import { playerSections } from "@/helpers/player_sections";
import { isPlayerUnavailable } from "@/helpers/players";
import { api } from "@/plugins/api";
import {
  EventType,
  type PlayerConfig,
  type PlayerType,
} from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const HIDE_UNAVAILABLE_PREFERENCE = "settings.players.hideUnavailable";

/**
 * The player configs of the players settings list, kept in sync with the
 * server: narrowed down by the filters of the list, sorted by name and split
 * into sections.
 */
export function useSettingsPlayerList() {
  const { getPreference, setPreference } = useUserPreferences();
  const hideUnavailable = getPreference<boolean>(
    HIDE_UNAVAILABLE_PREFERENCE,
    false,
  );

  const playerConfigs = ref<PlayerConfig[]>([]);
  const searchQuery = ref<string>("");
  const selectedProviders = ref<string[]>([]);
  const selectedPlayerTypes = ref<string[]>([]);
  const selectedStatuses = ref<string[]>([]);

  // listen for item updates to refresh items when that happens
  const unsub = api.subscribe_multi([EventType.PLAYER_CONFIG_UPDATED], () => {
    loadItems();
  });
  onBeforeUnmount(unsub);

  const filteredPlayers = computed(() => {
    let filtered = [...playerConfigs.value];

    // a disabled player has no player object, but it is disabled rather than unavailable
    if (hideUnavailable.value) {
      filtered = filtered.filter(
        (item) =>
          !item.enabled || !isPlayerUnavailable(api.players[item.player_id]),
      );
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter((item) => {
        const playerName = getPlayerName(item).toLowerCase();
        const providerName = (
          api.getProviderManifest(item.provider)?.name || item.provider
        ).toLowerCase();
        return playerName.includes(query) || providerName.includes(query);
      });
    }

    if (selectedProviders.value.length > 0) {
      filtered = filtered.filter((item) =>
        playerBelongsToProviders(item, selectedProviders.value),
      );
    }

    if (selectedPlayerTypes.value.length > 0) {
      filtered = filtered.filter((item) =>
        selectedPlayerTypes.value.includes(playerTypeOf(item)),
      );
    }

    if (selectedStatuses.value.length > 0) {
      filtered = filtered.filter((item) => {
        const player = api.players[item.player_id];
        return selectedStatuses.value.some((status) => {
          if (status === "available") {
            // serialized available is false while a player needs setup
            return item.enabled && player?.available;
          }
          if (status === "needs_setup") {
            return item.enabled && player?.needs_setup;
          }
          if (status === "unavailable") {
            return item.enabled && !player?.available && !player?.needs_setup;
          }
          return status === "disabled" && !item.enabled;
        });
      });
    }

    return filtered.sort((a, b) =>
      getPlayerName(a).localeCompare(getPlayerName(b)),
    );
  });

  const sections = computed(() =>
    playerSections(filteredPlayers.value, playerTypeOf),
  );

  const toggleHideUnavailable = function () {
    setPreference(HIDE_UNAVAILABLE_PREFERENCE, !hideUnavailable.value);
  };

  /** Take players the server removed off the list. */
  const dropPlayerConfigs = function (playerIds: string[]) {
    playerConfigs.value = playerConfigs.value.filter(
      (x) => !playerIds.includes(x.player_id),
    );
  };

  const loadItems = async function () {
    playerConfigs.value = (await getListedPlayerConfigs()).sort((a, b) =>
      getPlayerName(a).localeCompare(getPlayerName(b)),
    );
  };

  watch(
    () => api.players,
    (val) => {
      if (val) loadItems();
    },
    { immediate: true },
  );

  return {
    playerConfigs,
    searchQuery,
    selectedProviders,
    selectedPlayerTypes,
    selectedStatuses,
    hideUnavailable,
    filteredPlayers,
    sections,
    toggleHideUnavailable,
    dropPlayerConfigs,
    loadItems,
  };
}

// a disabled player has no player object, so it goes by the type its config holds
function playerTypeOf(config: PlayerConfig): PlayerType {
  return api.players[config.player_id]?.type ?? config.player_type;
}
