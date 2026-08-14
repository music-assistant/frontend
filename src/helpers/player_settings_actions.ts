// Everything that can be done to a player from the settings surfaces: the menu on the
// players list and the menu on the player settings page itself. Both build their menu
// from here so the two never drift apart.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { getPlayerSetupMenuItem } from "@/helpers/player_menu_items";
import { openLinkInNewTab } from "@/helpers/utils";
import { useUserPreferences } from "@/composables/userPreferences";
import { api } from "@/plugins/api";
import {
  PlayerConfig,
  PlayerType,
  ProviderFeature,
} from "@/plugins/api/interfaces";
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
      hide: !provider,
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
          void setPlayerEnabled(config, true);
          return;
        }
        eventbus.emit("deleteConfirmationDialog", {
          title: $t("player_select.disable_player_title", [
            getPlayerName(config),
          ]),
          message: $t("player_select.disable_player_confirmation"),
          confirmLabel: $t("settings.disable"),
          onConfirm: () => setPlayerEnabled(config, false),
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

/** The name shown for a player, which may only be configured and not registered yet. */
export const getPlayerName = (config: PlayerConfig): string =>
  config.name ||
  api.players[config.player_id]?.name ||
  config.default_name ||
  config.player_id;

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

async function setPlayerEnabled(config: PlayerConfig, enabled: boolean) {
  try {
    await api.savePlayerConfig(config.player_id, { enabled });
    if (!enabled) selectFallbackPlayer(config.player_id);
    toast.success($t("settings.player_saved"));
  } catch (error) {
    toast.error(String(error));
  }
}

async function deletePlayer(playerId: string, onDeleted?: () => void) {
  try {
    await api.removePlayer(playerId);
    selectFallbackPlayer(playerId);
    onDeleted?.();
  } catch (error) {
    toast.error(String(error));
  }
}

/** Hands the player bar to another player, so it does not point at one that just left. */
function selectFallbackPlayer(playerId: string) {
  if (store.activePlayerId !== playerId) return;
  const fallbackPlayer = Object.values(api.players).find(
    (candidate) =>
      candidate.player_id !== playerId &&
      candidate.available &&
      candidate.enabled &&
      !candidate.needs_setup &&
      !candidate.hide_in_ui &&
      !candidate.synced_to,
  );
  store.activePlayerId = fallbackPlayer?.player_id;
  if (!fallbackPlayer) {
    // leave nothing remembered, or the next visit waits for a player that is gone
    void useUserPreferences().setPreference("activePlayerId", null);
  }
}
