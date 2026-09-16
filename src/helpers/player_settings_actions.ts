// Everything that can be done to a player from the settings surfaces: the menu on the
// players list and the menu on the player settings page itself. Both build their menu
// from here so the two never drift apart.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { getPlayerName } from "@/helpers/player_config";
import { getPlayerSetupMenuItem } from "@/helpers/player_menu_items";
import { isSelectablePlayer } from "@/helpers/players";
import { openLinkInNewTab } from "@/helpers/utils";
import { setUserPreference } from "@/composables/userPreferences";
import { api } from "@/plugins/api";
import {
  PlayerConfig,
  PlayerType,
  ProviderFeature,
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
  Pencil,
  Power,
  Settings,
  SlidersHorizontal,
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
 * enabling and removing it.
 */
export const getPlayerSettingsMenuItems = (
  config: PlayerConfig,
  options: PlayerSettingsMenuOptions = {},
): ContextMenuItem[] => {
  const playerId = config.player_id;
  const player = api.players[playerId];
  const provider = api.getProvider(config.provider);
  const manifest = api.getProviderManifest(config.provider);
  const menuItems: ContextMenuItem[] = [];

  if (options.includeSections) {
    const sections = getPlayerSettingsSections(playerId);
    menuItems.push({
      label: "open_player_settings",
      action: () => router.push(`/settings/editplayer/${playerId}`),
      icon: markRaw(Settings),
      disabled: !provider,
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
    action: () => {
      eventbus.emit("playerRenameDialog", {
        playerId,
        name: config.name,
        defaultName: config.default_name,
      });
    },
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
      label: config.enabled ? "settings.disable" : "settings.enable",
      action: () => {
        if (!config.enabled) {
          void setPlayerEnabled(playerId, true);
          return;
        }
        eventbus.emit("deleteConfirmationDialog", {
          title: $t("player_select.disable_player_title", [
            getPlayerName(config),
          ]),
          message: $t("player_select.disable_player_confirmation"),
          confirmLabel: $t("settings.disable"),
          onConfirm: async () => {
            await setPlayerEnabled(playerId, false);
          },
        });
      },
      icon: markRaw(config.enabled ? CircleOff : Power),
      hide: !provider,
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
      hide: !playerCanBeDeleted(playerId),
    },
  );

  return menuItems;
};

/** Whether the player's provider offers to remove it. */
export const playerCanBeDeleted = (playerId: string): boolean => {
  const player = api.players[playerId];
  if (!player) return true;
  const feature =
    player.type === PlayerType.GROUP
      ? ProviderFeature.REMOVE_GROUP_PLAYER
      : ProviderFeature.REMOVE_PLAYER;
  return !!api
    .getProvider(player.provider)
    ?.supported_features.includes(feature);
};

/**
 * Switch a player on or off, and say whether the change landed. Switching off
 * the player the player bar points at hands the bar to another player first.
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

async function deletePlayer(playerId: string, onDeleted?: () => void) {
  try {
    await api.removePlayer(playerId);
    selectFallbackPlayer(playerId);
    onDeleted?.();
  } catch {
    // a failed command is already reported by the api layer
  }
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
