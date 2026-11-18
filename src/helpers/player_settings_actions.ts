// Everything that can be done to a player from the settings surfaces: the menu on the
// players list and the menu on the player settings page itself. Both build their menu
// from here so the two never drift apart. The menu of a player that still needs setup
// lives here too, as managing it is all such a player has to offer.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { getPlayerName } from "@/helpers/player_config";
import { getSplittableProtocols } from "@/helpers/player_merge";
import { getPlayerSetupMenuItem } from "@/helpers/player_menu_items";
import { isSelectablePlayer } from "@/helpers/players";
import { openLinkInNewTab } from "@/helpers/utils";
import { setUserPreference } from "@/composables/userPreferences";
import { api } from "@/plugins/api";
import {
  Player,
  PlayerConfig,
  PlayerProtocolInfo,
  PlayerType,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import {
  AudioLines,
  BookOpen,
  CircleOff,
  Cog,
  ListMusic,
  Merge,
  Pencil,
  Power,
  Settings,
  SlidersHorizontal,
  Split,
  Trash2,
} from "@lucide/vue";
import { markRaw } from "vue";
import { toast } from "vue-sonner";

export interface PlayerSettingsMenuOptions {
  // include links to the individual settings sections; the settings page itself
  // already lists them and leaves these out
  includeSections?: boolean;
  // called once the player is gone, so its settings page can leave
  onDeleted?: () => void;
  // called with the id of the player it was merged into
  onMerged?: (targetPlayerId: string) => void;
  // called once an output is split off as a player of its own
  onSplitOff?: () => void;
}

/** Which settings sections a player has something to show for. */
export const getPlayerSettingsSections = (playerId: string) => {
  const player = api.players[playerId];
  return {
    player: true,
    queue: playerId in api.queues,
    dsp: !!player && player.type !== PlayerType.GROUP,
    options: !!player && player.options.length > 0,
  };
};

/**
 * Menu entries acting on a player: its settings sections, renaming, (re)configuring,
 * merging it into another player, splitting an output off, enabling and removing it.
 */
export const getPlayerSettingsMenuItems = (
  config: PlayerConfig,
  options: PlayerSettingsMenuOptions = {},
): ContextMenuItem[] => {
  const playerId = config.player_id;
  const player = api.players[playerId];
  const provider = api.getProvider(config.provider);
  const manifest = api.getProviderManifest(config.provider);
  const splittable = player ? getSplittableProtocols(player) : [];
  const menuItems: ContextMenuItem[] = [];

  if (options.includeSections) {
    const sections = getPlayerSettingsSections(playerId);
    menuItems.push({
      label: "open_player_settings",
      action: () => router.push(`/settings/editplayer/${playerId}`),
      icon: markRaw(Settings),
    });
    if (sections.queue) {
      menuItems.push({
        label: "open_queue_settings",
        action: () => router.push(`/settings/editqueue/${playerId}`),
        icon: markRaw(ListMusic),
      });
    }
    if (sections.dsp) {
      menuItems.push({
        label: "open_dsp_settings",
        action: () => router.push(`/settings/editplayer/${playerId}/dsp`),
        icon: markRaw(AudioLines),
      });
    }
    if (sections.options) {
      menuItems.push({
        label: "player_options.open",
        action: () => router.push(`/settings/editplayer/${playerId}/options`),
        icon: markRaw(SlidersHorizontal),
      });
    }
  }

  menuItems.push({
    label: "player_select.rename_player",
    action: () => openPlayerRenameDialog(config),
    icon: markRaw(Pencil),
  });

  const setupMenuItem = player && getPlayerSetupMenuItem(player);
  if (setupMenuItem) menuItems.push(setupMenuItem);

  menuItems.push(
    {
      label: "settings.provider_settings",
      labelArgs: { name: provider?.name ?? manifest?.name ?? config.provider },
      action: () =>
        router.push(
          `/settings/editprovider/${provider?.instance_id ?? config.provider}`,
        ),
      icon: markRaw(Cog),
      // a player provider's settings take config.providers.write
      hide: !provider || !authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE),
    },
    {
      label: "settings.documentation",
      action: () => openLinkInNewTab(manifest?.documentation || ""),
      icon: markRaw(BookOpen),
      disabled: !manifest?.documentation,
    },
    {
      label: "settings.merge_player",
      action: () =>
        eventbus.emit("playerMergeDialog", {
          playerId,
          playerName: getPlayerName(config),
          onMerged: options.onMerged,
        }),
      icon: markRaw(Merge),
      hide: config.player_type === PlayerType.GROUP,
    },
    {
      label: "settings.split_off_output",
      icon: markRaw(Split),
      subItems: splittable
        .map((protocol) => ({
          // the id keeps two outputs of the same name apart
          label: protocol.protocol_id,
          text: getOutputName(protocol),
          action: () =>
            confirmSplitOff(
              protocol,
              getPlayerName(config),
              options.onSplitOff,
            ),
        }))
        .sort((left, right) => left.text.localeCompare(right.text)),
      hide: !splittable.length,
    },
    {
      label: config.enabled ? "settings.disable" : "settings.enable",
      action: () => {
        if (!config.enabled) {
          void setPlayerEnabled(playerId, true);
          return;
        }
        confirmDisablePlayer(playerId, getPlayerName(config));
      },
      icon: markRaw(config.enabled ? CircleOff : Power),
    },
    {
      label: "settings.delete",
      action: () => {
        eventbus.emit("deleteConfirmationDialog", {
          title: $t("settings.delete_player_title", [getPlayerName(config)]),
          message: $t("settings.delete_player_confirmation"),
          onConfirm: () => deletePlayer(playerId, options.onDeleted),
        });
      },
      icon: markRaw(Trash2),
      color: "error",
    },
  );

  return menuItems;
};

/**
 * Menu entries for a player that still needs setup and so can't play yet:
 * setting it up, renaming it, opening its settings and disabling it. Empty for
 * a role that may not change player settings.
 */
export const getSetupRequiredPlayerMenuItems = (
  player: Player,
): ContextMenuItem[] => {
  // setting a player up takes the same scope as changing its settings
  if (!authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE)) return [];

  const playerId = player.player_id;
  const menuItems: ContextMenuItem[] = [];

  const setupMenuItem = getPlayerSetupMenuItem(player);
  if (setupMenuItem) menuItems.push(setupMenuItem);

  menuItems.push(
    {
      label: "player_select.rename_player",
      // only the config tells a custom name apart from the one the provider
      // reports; a failed command is already reported by the api layer
      action: () =>
        void api
          .getPlayerConfig(playerId)
          .then(openPlayerRenameDialog)
          .catch(() => undefined),
      icon: markRaw(Pencil),
    },
    {
      label: "open_settings",
      action: () => {
        store.showFullscreenPlayer = false;
        store.showPlayersMenu = false;
        router.push(`/settings/editplayer/${playerId}`);
      },
      icon: "mdi-cog-outline",
    },
    {
      label: "settings.disable",
      action: () => confirmDisablePlayer(playerId, player.name),
      icon: markRaw(CircleOff),
    },
  );

  return menuItems;
};

/**
 * Remove every player whose device is gone, after asking: the confirmation names
 * the players the server would remove, or says that there are none.
 *
 * @param playerConfigs The players as the settings list shows them, in its order;
 * the confirmation names the players and orders them the same way.
 * @param onRemoved Called with the ids of the players the server removed.
 */
export const removeUnavailablePlayers = async (
  playerConfigs: PlayerConfig[],
  onRemoved?: (playerIds: string[]) => void,
): Promise<void> => {
  let candidates: string[];
  try {
    candidates = await api.removeUnavailablePlayers(true);
  } catch {
    // the api layer reports the failure with the server's reason, such as
    // providers that have only just started and are still finding their devices
    return;
  }
  const count = candidates.length;
  if (!count) {
    toast.info($t("settings.no_unavailable_players"));
    return;
  }
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("settings.remove_unavailable_players_title"),
    message: $t("settings.remove_unavailable_players_confirmation", count, {
      named: { count },
    }),
    items: getListedPlayerNames(candidates, playerConfigs),
    confirmLabel: $t("remove"),
    onConfirm: () => removeUnavailablePlayersConfirmed(onRemoved),
  });
};

/**
 * Merge a player into another one, and say whether the merge landed. The player
 * bar follows to the player that stays.
 *
 * @param playerId The player that goes.
 * @param targetPlayerId The player that stays.
 */
export const mergePlayer = async (
  playerId: string,
  targetPlayerId: string,
): Promise<boolean> => {
  try {
    await api.mergePlayers(playerId, targetPlayerId);
  } catch {
    // a failed command is already reported by the api layer, with the
    // server's reason why the two can not be one player
    return false;
  }
  if (store.activePlayerId === playerId) {
    store.activePlayerId = targetPlayerId;
    void setUserPreference("activePlayerId", targetPlayerId);
  }
  toast.success($t("settings.player_merged"));
  return true;
};

/** The name of an output of a player, such as "AirPlay". */
export const getOutputName = (
  protocol: Pick<PlayerProtocolInfo, "domain">,
): string => api.getProviderManifest(protocol.domain)?.name ?? protocol.domain;

/**
 * Switch a player on or off, and say whether the change landed. Switching off
 * the player the player bar points at hands the bar to another player.
 */
export const setPlayerEnabled = async (
  playerId: string,
  enabled: boolean,
): Promise<boolean> => {
  try {
    await api.savePlayerConfig(playerId, { enabled });
    if (!enabled) selectFallbackPlayer(playerId);
    toast.success($t("settings.player_saved"));
    return true;
  } catch {
    // a failed command is already reported by the api layer
    return false;
  }
};

/**
 * Give a player a name of its own, or hand it back to the name its provider
 * reports by clearing the name, and say whether the change landed.
 */
export const renamePlayer = async (
  playerId: string,
  name: string | null,
): Promise<boolean> => {
  try {
    await api.savePlayerConfig(playerId, { name });
    toast.success($t("settings.player_saved"));
    return true;
  } catch {
    // a failed command is already reported by the api layer
    return false;
  }
};

function openPlayerRenameDialog(config: PlayerConfig) {
  eventbus.emit("playerRenameDialog", {
    playerId: config.player_id,
    name: config.name,
    defaultName: config.default_name,
  });
}

function confirmSplitOff(
  protocol: PlayerProtocolInfo,
  playerName: string,
  onSplitOff?: () => void,
) {
  const outputName = getOutputName(protocol);
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("settings.split_off_output_title", [outputName, playerName]),
    message: $t("settings.split_off_output_confirmation", [
      outputName,
      playerName,
    ]),
    confirmLabel: $t("settings.split_off"),
    destructive: false,
    onConfirm: async () => {
      try {
        await api.unlinkProtocol(protocol.protocol_id);
      } catch {
        // a failed command is already reported by the api layer
        return;
      }
      toast.success($t("settings.output_split_off", [outputName]));
      onSplitOff?.();
    },
  });
}

function confirmDisablePlayer(playerId: string, playerName: string) {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("player_select.disable_player_title", [playerName]),
    message: $t("player_select.disable_player_confirmation"),
    confirmLabel: $t("settings.disable"),
    onConfirm: async () => {
      await setPlayerEnabled(playerId, false);
    },
  });
}

async function deletePlayer(playerId: string, onDeleted?: () => void) {
  try {
    await api.removePlayer(playerId);
    selectFallbackPlayer(playerId);
    onDeleted?.();
  } catch {
    // a failed command is already reported by the api layer
  }
}

async function removeUnavailablePlayersConfirmed(
  onRemoved?: (playerIds: string[]) => void,
) {
  let removed: string[];
  try {
    removed = await api.removeUnavailablePlayers();
  } catch {
    // a failed command is already reported by the api layer
    return;
  }
  removed.forEach(selectFallbackPlayer);
  onRemoved?.(removed);
  toast.success(
    $t("settings.unavailable_players_removed", removed.length, {
      named: { count: removed.length },
    }),
  );
}

/**
 * The names of the given players in the order of the configs, followed by the id
 * of any player the configs do not hold.
 */
function getListedPlayerNames(
  playerIds: string[],
  playerConfigs: PlayerConfig[],
): string[] {
  const listed = playerConfigs.filter((config) =>
    playerIds.includes(config.player_id),
  );
  const unlisted = playerIds.filter(
    (playerId) => !listed.some((config) => config.player_id === playerId),
  );
  return [...listed.map(getPlayerName), ...unlisted];
}

/** Hands the player bar to another player, so it does not point at one that just left. */
function selectFallbackPlayer(playerId: string) {
  if (store.activePlayerId !== playerId) return;
  store.activePlayerId = Object.values(api.players).find(
    (candidate) =>
      candidate.player_id !== playerId &&
      isSelectablePlayer(candidate) &&
      !candidate.hide_in_ui &&
      !candidate.synced_to,
  )?.player_id;
  // a remembered player that never registers again leaves the next visit
  // waiting for it instead of picking a player that is there
  void setUserPreference("activePlayerId", null);
}
