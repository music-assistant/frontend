// Everything that can be done to a player from the settings surfaces: the menu on the
// players list and the menu on the player settings page itself. Both build their menu
// from here so the two never drift apart. The menu of a player that still needs setup
// lives here too, as managing it is all such a player has to offer. So does the menu of
// each output on the player settings page.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  canCombineSpeakers,
  getComposableProtocol,
  type MultiChannelCandidates,
} from "@/helpers/multi_channel";
import { getPlayerName } from "@/helpers/player_config";
import { getSplittableProtocols } from "@/helpers/player_merge";
import { getPlayerSetupMenuItem } from "@/helpers/player_menu_items";
import { isSelectablePlayer } from "@/helpers/players";
import { openLinkInNewTab } from "@/helpers/utils";
import { setUserPreference } from "@/composables/userPreferences";
import { api } from "@/plugins/api";
import {
  OutputProtocol,
  Player,
  PlayerConfig,
  PlayerProtocolInfo,
  PlayerType,
  Scope,
  SpeakerChannel,
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
  Group,
  ListMusic,
  Merge,
  Pencil,
  Power,
  Settings,
  SlidersHorizontal,
  Split,
  Trash2,
  Ungroup,
} from "@lucide/vue";
import { markRaw } from "vue";
import { toast } from "vue-sonner";

// the players a command of this app is removing right now, such as the speakers that go
// up in a new multi-channel player
const playersBeingRemoved = new Set<string>();

export interface PlayerSettingsMenuOptions {
  // include links to the individual settings sections; the settings page itself
  // already lists them and leaves these out
  includeSections?: boolean;
  // called once the player is gone, so its settings page can leave
  onDeleted?: () => void;
  // called with the id of the player it was merged into
  onMerged?: (targetPlayerId: string) => void;
}

export interface OutputMenuOptions {
  // called once the output is split off as a player of its own
  onSplitOff?: () => void;
  // the speakers the server lists as candidates of a new multi-channel player; an output
  // offers to start one only when its player is among them
  multiChannelCandidates?: MultiChannelCandidates;
  // called with the id of the multi-channel player the output moved into
  onMultiChannelCreated?: (playerId: string) => void;
}

/**
 * Whether a command of this app is removing a player right now, so its config is about to
 * go: deleting it, merging it into another one, taking it apart or combining it into a
 * multi-channel player.
 */
export const isPlayerBeingRemoved = (playerId: string): boolean =>
  playersBeingRemoved.has(playerId);

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
 * merging it into another player, enabling and removing it.
 */
export const getPlayerSettingsMenuItems = (
  config: PlayerConfig,
  options: PlayerSettingsMenuOptions = {},
): ContextMenuItem[] => {
  const playerId = config.player_id;
  const player = api.players[playerId];
  const provider = api.getProvider(config.provider);
  const manifest = api.getProviderManifest(config.provider);
  // a multi-channel player its provider composed is taken apart rather than deleted,
  // and is no device that shows up as two players; a disabled one has no live state
  const composedSet =
    (player?.type ?? config.player_type) === PlayerType.MULTI_CHANNEL &&
    canCombineSpeakers(config.provider);
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
      hide: config.player_type === PlayerType.GROUP || composedSet,
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
      label: "settings.multi_channel.take_apart",
      action: () =>
        confirmTakeApart(playerId, getPlayerName(config), options.onDeleted),
      icon: markRaw(Ungroup),
      hide: !composedSet,
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
      hide: composedSet,
    },
  );

  return menuItems;
};

/**
 * Menu entries acting on one output of a player: splitting it off as a player of its
 * own, and combining its speaker with another one into a multi-channel player. Empty
 * when there is nothing to do with the output.
 */
export const getOutputMenuItems = (
  config: PlayerConfig,
  output: OutputProtocol,
  options: OutputMenuOptions = {},
): ContextMenuItem[] => {
  const player = api.players[config.player_id];
  // a player holds one protocol of each domain; the domain also finds the protocol of
  // the native output, whose id is "native" rather than that of its protocol
  const protocol = player
    ? getSplittableProtocols(player).find(
        (candidate) => candidate.domain === output.protocol_domain,
      )
    : undefined;
  const menuItems: ContextMenuItem[] = [];

  if (protocol) {
    menuItems.push({
      label: "settings.split_off_output",
      action: () =>
        confirmSplitOff(protocol, getPlayerName(config), options.onSplitOff),
      icon: markRaw(Split),
    });
  }

  const composableProtocol =
    player &&
    getComposableProtocol(player, output, options.multiChannelCandidates ?? {});
  if (composableProtocol) {
    menuItems.push({
      label: "settings.multi_channel.make",
      action: () =>
        eventbus.emit("multiChannelPlayerDialog", {
          playerId: config.player_id,
          playerName: getPlayerName(config),
          protocol: composableProtocol,
          onCreated: options.onMultiChannelCreated,
        }),
      icon: markRaw(Group),
    });
  }

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
    await whileRemoving([playerId], () =>
      api.mergePlayers(playerId, targetPlayerId),
    );
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

/**
 * Combine speakers into one new multi-channel player, and return it, or undefined when
 * the server refuses. The player bar follows a speaker to the new player.
 *
 * @param provider The instance id of the provider whose speakers to combine.
 * @param name The name of the new player.
 * @param members The channel each speaker plays, by the player id of the speaker.
 */
export const createMultiChannelPlayer = async (
  provider: string,
  name: string,
  members: Record<string, SpeakerChannel>,
): Promise<Player | undefined> => {
  let player: Player;
  try {
    player = await whileRemoving(Object.keys(members), () =>
      api.createMultiChannelPlayer(provider, name, members),
    );
  } catch {
    // a failed command is already reported by the api layer, with the
    // server's reason why the speakers can not be combined
    return undefined;
  }
  if (store.activePlayerId && store.activePlayerId in members) {
    store.activePlayerId = player.player_id;
    void setUserPreference("activePlayerId", player.player_id);
  }
  toast.success($t("settings.multi_channel.created", [name]));
  return player;
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

function confirmTakeApart(
  playerId: string,
  playerName: string,
  onDeleted?: () => void,
) {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("settings.multi_channel.take_apart_title", [playerName]),
    message: $t("settings.multi_channel.take_apart_confirmation", [playerName]),
    confirmLabel: $t("settings.multi_channel.take_apart_confirm"),
    onConfirm: async () => {
      try {
        await whileRemoving([playerId], () => api.removePlayer(playerId));
      } catch {
        // a failed command is already reported by the api layer
        return;
      }
      selectFallbackPlayer(playerId);
      toast.success($t("settings.multi_channel.taken_apart", [playerName]));
      onDeleted?.();
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
    await whileRemoving([playerId], () => api.removePlayer(playerId));
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

/** Run a command that removes players, telling the rest of the app it is on its way. */
async function whileRemoving<T>(
  playerIds: string[],
  command: () => Promise<T>,
): Promise<T> {
  for (const playerId of playerIds) playersBeingRemoved.add(playerId);
  try {
    return await command();
  } finally {
    for (const playerId of playerIds) playersBeingRemoved.delete(playerId);
  }
}
