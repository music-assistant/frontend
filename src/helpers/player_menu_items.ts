// shared logic to show player menu items
// this menu is shown in the full screen player and in the player list
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import api from "@/plugins/api";
import {
  Player,
  PlayerQueue,
  PlayerType,
  RepeatMode,
  PLAYER_CONTROL_NONE,
} from "@/plugins/api/interfaces";
import { isQueueDynamicPlaylist } from "@/plugins/api/helpers";
import { authManager } from "@/plugins/auth";
import router from "@/plugins/router";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";

export const getPlayerMenuItems = (
  player: Player,
  playerQueue: PlayerQueue | undefined,
  options: {
    // which surface this menu is rendered on:
    // - "queue": the fullscreen player (now-playing/queue) overflow menu
    // - "player": the player list/select card menu
    context: "queue" | "player";
    // queue context only: when true, omit shuffle/repeat because dedicated
    // controls for them are currently visible (they are responsive and hidden
    // on small screens, so the overflow menu remains the fallback on mobile).
    hideShuffleRepeat?: boolean;
  },
): ContextMenuItem[] => {
  const menuItems: ContextMenuItem[] = [];
  const isQueue = options.context === "queue";
  const isPlayer = options.context === "player";
  const hideShuffleRepeat = options.hideShuffleRepeat === true;

  // power off/on (player menu only)
  if (isPlayer && player?.power_control != PLAYER_CONTROL_NONE) {
    menuItems.push({
      label: player.powered ? "power_off_player" : "power_on_player",
      labelArgs: [],
      action: () => {
        api.playerCommandPowerToggle(player.player_id);
      },
      icon: "mdi-power",
    });
  }

  // stop playback (both menus)
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

  const isSingleDynamicPlaylist = isQueueDynamicPlaylist(playerQueue);

  // shuffle (queue menu only; hidden when the dedicated control is visible)
  if (
    isQueue &&
    playerQueue &&
    !isSingleDynamicPlaylist &&
    !hideShuffleRepeat
  ) {
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

  // repeat (queue menu only; hidden when the dedicated control is visible)
  if (
    isQueue &&
    playerQueue &&
    !isSingleDynamicPlaylist &&
    !hideShuffleRepeat
  ) {
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

  // transfer queue (both menus; only when the queue is the active source)
  if (playerQueue?.active && playerQueue.items > 0) {
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
            !p.synced_to &&
            !p.hide_in_ui,
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

  // clear queue (queue menu only)
  if (isQueue && playerQueue?.items && playerQueue.items > 0) {
    menuItems.push({
      label: "queue_clear",
      labelArgs: [],
      action: () => {
        api.queueCommandClear(playerQueue!.queue_id);
      },
      icon: "mdi-cancel",
    });
  }

  // save queue as playlist (queue menu only)
  if (isQueue && playerQueue?.items && playerQueue.items > 0) {
    menuItems.push({
      label: "save_queue_as_playlist",
      labelArgs: [],
      action: () => {
        eventbus.emit("createPlaylist", { queueId: playerQueue!.queue_id });
      },
      icon: "mdi-playlist-plus",
    });
  }

  // select source (both menus; only when more than one source is selectable)
  const selectableSources = player.source_list.filter(
    (s) => !s.passive || s.id == player.active_source,
  );
  if (!player.synced_to && selectableSources.length > 1) {
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

  // select sound mode (player menu only; only when more than one is selectable)
  const selectableSoundModes = player.sound_mode_list.filter(
    (s) => !s.passive || s.id == player.active_sound_mode,
  );
  if (isPlayer && selectableSoundModes.length > 1) {
    menuItems.push({
      label: "select_sound_mode",
      labelArgs: [],
      icon: "mdi-music-note-eighth",
      subItems: selectableSoundModes
        .map((s) => {
          return {
            label: s.name,
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

  // settings shortcuts (admin only)
  if (authManager.isAdmin()) {
    // open queue settings (queue menu only)
    if (isQueue) {
      menuItems.push({
        label: "open_queue_settings",
        labelArgs: [],
        action: () => {
          store.showFullscreenPlayer = false;
          store.showPlayersMenu = false;
          router.push(
            `/settings/editqueue/${playerQueue?.queue_id ?? player.player_id}`,
          );
        },
        icon: "mdi-cog-outline",
      });
    }

    // open player settings (player menu only)
    if (isPlayer) {
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
    }

    // open dsp settings (player menu only)
    if (isPlayer && player.type !== PlayerType.GROUP) {
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

    // open player options (both menus)
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
