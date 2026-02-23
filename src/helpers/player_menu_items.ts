// shared logic to show player menu items
// this menu is shown in the full screen player and in the player list
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import api from "@/plugins/api";
import {
  Player,
  PlayerQueue,
  PlayerFeature,
  PlayerType,
  RepeatMode,
  PLAYER_CONTROL_NONE,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import router from "@/plugins/router";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { $t } from "@/plugins/i18n";

export const getPlayerMenuItems = (
  player: Player,
  playerQueue?: PlayerQueue,
): ContextMenuItem[] => {
  const menuItems: ContextMenuItem[] = [];
  // power off/on
  if (player?.power_control != PLAYER_CONTROL_NONE) {
    menuItems.push({
      label: player.powered ? "power_off_player" : "power_on_player",
      labelArgs: [],
      action: () => {
        api.playerCommandPowerToggle(player.player_id);
      },
      icon: "mdi-power",
    });
  }
  // add stop playback menu item
  if (
    player?.playback_state == "playing" ||
    player?.playback_state == "paused"
  ) {
    menuItems.push({
      label: "stop_playback",
      labelArgs: [],
      action: () => {
        api.playerCommandStop(player.player_id);
      },
      icon: "mdi-stop",
    });
  }

  // add 'synchronize with' menu item
  const playersToSyncWith = Object.values(api.players).filter(
    (p) =>
      p.player_id != player.player_id &&
      p.available &&
      p.enabled &&
      (p.can_group_with.includes(player.provider) ||
        p.can_group_with.includes(player.player_id)) &&
      p.supported_features.includes(PlayerFeature.SET_MEMBERS) &&
      !p.synced_to,
  );
  if (
    player.supported_features.includes(PlayerFeature.SET_MEMBERS) &&
    !player.synced_to &&
    player.type == PlayerType.PLAYER &&
    player.group_members.length == 0 &&
    playersToSyncWith.length > 0
  ) {
    menuItems.push({
      label: "sync_player_with",
      labelArgs: [],
      icon: "mdi-link-variant",
      subItems: playersToSyncWith
        .map((p) => {
          return {
            label: p.name,
            labelArgs: [],
            action: () => {
              api.playerCommandGroup(player.player_id, p.player_id);
            },
          };
        })
        .sort((a, b) =>
          a.label.toUpperCase() > b.label?.toUpperCase() ? 1 : -1,
        ),
    });
  }
  // add enable/disable shuffle menu item
  if (playerQueue) {
    menuItems.push({
      label: playerQueue.shuffle_enabled ? "shuffle_disable" : "shuffle_enable",
      labelArgs: [],
      action: () => {
        api.queueCommandShuffleToggle(playerQueue.queue_id);
      },
      icon: playerQueue.shuffle_enabled
        ? "mdi-shuffle-disabled"
        : "mdi-shuffle",
    });
  }

  // add repeat mode item
  if (playerQueue) {
    menuItems.push({
      label: "select_repeat_mode",
      labelArgs: [],
      subItems: [
        {
          label: "repeat_mode.off",
          labelArgs: [],
          action: () => {
            api.queueCommandRepeat(playerQueue!.queue_id, RepeatMode.OFF);
          },
          selected: playerQueue.repeat_mode == RepeatMode.OFF,
        },
        {
          label: "repeat_mode.all",
          labelArgs: [],
          action: () => {
            api.queueCommandRepeat(playerQueue!.queue_id, RepeatMode.ALL);
          },
          selected: playerQueue.repeat_mode == RepeatMode.ALL,
        },
        {
          label: "repeat_mode.one",
          labelArgs: [],
          action: () => {
            api.queueCommandRepeat(playerQueue!.queue_id, RepeatMode.ONE);
          },
          selected: playerQueue.repeat_mode == RepeatMode.ONE,
        },
      ],
      icon: "mdi-repeat",
    });
  }

  // add 'transfer queue' menu item
  if (playerQueue?.items && playerQueue.items > 0) {
    menuItems.push({
      label: "transfer_queue",
      icon: "mdi-swap-horizontal",
      subItems: Object.values(api.players)
        .filter(
          (p) =>
            p.player_id != playerQueue!.queue_id &&
            p.player_id != player.player_id &&
            p.available &&
            p.enabled &&
            !p.synced_to,
        )
        .map((p) => {
          return {
            label: p.name,
            labelArgs: [],
            action: () => {
              api.queueCommandTransfer(playerQueue!.queue_id, p.player_id);
              store.activePlayerId = p.player_id;
            },
          };
        })
        .sort((a, b) =>
          a.label.toUpperCase() > b.label?.toUpperCase() ? 1 : -1,
        ),
    });
  }
  // add 'clear queue' menu item
  if (playerQueue?.items && playerQueue.items > 0) {
    menuItems.push({
      label: "queue_clear",
      labelArgs: [],
      action: () => {
        api.queueCommandClear(playerQueue!.queue_id);
      },
      icon: "mdi-cancel",
    });
  }
  // add 'save queue as playlist' menu item
  if (playerQueue?.items && playerQueue.items > 0) {
    menuItems.push({
      label: "save_queue_as_playlist",
      labelArgs: [],
      action: () => {
        eventbus.emit("createPlaylist", { queueId: playerQueue!.queue_id });
      },
      icon: "mdi-playlist-plus",
    });
  }

  // add 'select source' menu item
  const selectableSources = player.source_list.filter(
    (s) => !s.passive || s.id == player.active_source,
  );
  if (!player.synced_to && selectableSources.length > 0) {
    menuItems.push({
      label: "select_source",
      labelArgs: [],
      icon: "mdi-import",
      subItems: selectableSources
        .map((s) => {
          return {
            label: s.name,
            labelArgs: [],
            disabled: s.id == player.active_source,
            selected: s.id == player.active_source,
            action: () => {
              api.playerCommandGroupSelectSource(player.player_id, s.id);
            },
          };
        })
        .sort((a, b) =>
          a.label.toUpperCase() > b.label?.toUpperCase() ? 1 : -1,
        ),
    });
  }

  // add 'select sound mode' menu item
  const selectableSoundModes = player.sound_mode_list.filter(
    (s) => !s.passive || s.id == player.active_sound_mode,
  );
  if (selectableSoundModes.length > 0) {
    menuItems.push({
      label: "select_sound_mode",
      labelArgs: [],
      icon: "mdi-music-note-eighth",
      subItems: selectableSoundModes
        .map((s) => {
          return {
            label: $t(s.translation_key || s.name, s.name),
            labelArgs: [],
            disabled: s.id === player.active_sound_mode,
            selected: s.id === player.active_sound_mode,
            action: () => {
              api.playerCommandSelectSoundMode(player.player_id, s.id);
            },
          };
        })
        .sort((a, b) =>
          a.label.toUpperCase() > b.label?.toUpperCase() ? 1 : -1,
        ),
    });
  }

  // add 'don't stop the music' menu item
  if (playerQueue && "dont_stop_the_music_enabled" in playerQueue) {
    menuItems.push({
      label: playerQueue.dont_stop_the_music_enabled
        ? "dont_stop_the_music_disable"
        : "dont_stop_the_music_enable",
      labelArgs: [],
      action: () => {
        api.queueCommandDontStopTheMusicToggle(playerQueue.queue_id);
      },
      icon: "mdi-all-inclusive",
    });
  }
  // add player settings (admin only)
  if (authManager.isAdmin()) {
    menuItems.push({
      label: "open_player_settings",
      labelArgs: [],
      action: () => {
        store.showFullscreenPlayer = false;
        store.showPlayersMenu = false;
        router.push(`/settings/editplayer/${player.player_id}`);
      },
      icon: "mdi-cog-outline",
    });

    // add shortcut to dsp settings
    if (player.type !== PlayerType.GROUP) {
      menuItems.push({
        label: "open_dsp_settings",
        labelArgs: [],
        action: () => {
          store.showFullscreenPlayer = false;
          store.showPlayersMenu = false;
          router.push(`/settings/editplayer/${player.player_id}/dsp`);
        },
        icon: "mdi-equalizer",
      });
    }

    // add shortcut to player options
    if (player.options.length > 0) {
      menuItems.push({
        label: "player_options.open",
        labelArgs: [],
        action: () => {
          store.showFullscreenPlayer = false;
          store.showPlayersMenu = false;
          router.push(`/settings/editplayer/${player.player_id}/options`);
        },
        icon: "mdi-tune",
      });
    }
  }

  return menuItems;
};
