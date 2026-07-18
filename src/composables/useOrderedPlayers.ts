import { isBuiltinPlayer, playerVisible } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { PlaybackState, type Player } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed } from "vue";

export function useOrderedPlayers() {
  return computed(() =>
    Object.values(api.players)
      .filter((player) => playerVisible(player))
      .sort(comparePlayers),
  );
}

function comparePlayers(left: Player, right: Player) {
  const priorityDifference = getPlayerPriority(left) - getPlayerPriority(right);
  if (priorityDifference !== 0) return priorityDifference;

  return left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  });
}

function getPlayerPriority(player: Player) {
  if (player.player_id === store.activePlayerId) return 0;
  if (isBuiltinPlayer(player)) return 1;
  if (player.playback_state === PlaybackState.PLAYING) return 2;
  return 3;
}
