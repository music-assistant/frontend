// shared logic to show player menu items
// this menu is shown in the full screen player and in the player list
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import api from "@/plugins/api";
import {
  Player,
  PlayerQueue,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

export const getPlayerMenuItems = (
  player?: Player,
  playerQueue?: PlayerQueue,
): ContextMenuItem[] => {
  if (!player && !playerQueue) return [];
  if (!player) player = api.players[playerQueue!.queue_id];
  if (!playerQueue && player.active_source in api.queues) {
    playerQueue = api.queues[player.active_source];
  } else if (!playerQueue && player.player_id in api.queues) {
    playerQueue = api.queues[player.player_id];
  }

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

  // add 'transfer queue' menu item
  if (playerQueue?.items) {
    menuItems.push({
      label: "transfer_queue",
      icon: "mdi-swap-horizontal",
      subItems: Object.values(api.queues)
        .filter((p) => p.queue_id != playerQueue!.queue_id && p.available)
        .map((p) => {
          return {
            label: p.display_name,
            labelArgs: [],
            action: () => {
              api.queueCommandTransfer(playerQueue!.queue_id, p.queue_id);
              store.activePlayerId = p.queue_id;
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
