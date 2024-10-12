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
} from "@/plugins/api/interfaces";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

export const getPlayerMenuItems = (
  player: Player,
  playerQueue?: PlayerQueue,
): ContextMenuItem[] => {
  // power off/on
  const menuItems: ContextMenuItem[] = [
    {
      label: player.powered ? "power_off_player" : "power_on_player",
      labelArgs: [],
      action: () => {
        api.playerCommandPowerToggle(player.player_id);
      },
      icon: "mdi-power",
    },
  ];

  // add 'synchronize with' menu item
  if (
    player.supported_features.includes(PlayerFeature.SYNC) &&
    !player.synced_to &&
    player.type == PlayerType.PLAYER &&
    player.group_childs.length == 0
  ) {
    menuItems.push({
      label: "sync_player_with",
      labelArgs: [],
      icon: "mdi-link-variant",
      subItems: Object.values(api.players)
        .filter(
          (p) =>
            p.player_id != player.player_id &&
            p.available &&
            p.enabled &&
            p.provider == player.provider &&
            p.type == PlayerType.PLAYER &&
            p.group_childs.length == 0 &&
            p.supported_features.includes(PlayerFeature.SYNC) &&
            !p.synced_to,
        )
        .map((p) => {
          return {
            label: p.display_name,
            labelArgs: [],
            action: () => {
              api.playerCommandSync(player.player_id, p.player_id);
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
  if (playerQueue?.items) {
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
            label: p.display_name,
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
  if (playerQueue?.items) {
    menuItems.push({
      label: "queue_clear",
      labelArgs: [],
      action: () => {
        api.queueCommandClear(playerQueue!.queue_id);
      },
      icon: "mdi-cancel",
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
  // add player settings
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

  return menuItems;
};
