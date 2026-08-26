import {
  isBuiltinPlayer,
  isPlayerActive,
  playerVisible,
} from "@/helpers/players";
import { api } from "@/plugins/api";
import { PlaybackState, type Player } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, type MaybeRefOrGetter, toValue } from "vue";

interface OrderedPlayersOptions {
  allowNeedsSetup?: boolean;
  allowSources?: boolean;
  selectedPlayerFirst?: MaybeRefOrGetter<boolean>;
  activePlayersFirst?: MaybeRefOrGetter<boolean>;
  includePausedAsActive?: boolean;
}

export function useOrderedPlayers(opts?: OrderedPlayersOptions) {
  return computed(() =>
    Object.values(api.players)
      .filter((player) =>
        playerVisible(
          player,
          false,
          opts?.allowNeedsSetup ?? false,
          opts?.allowSources ?? false,
        ),
      )
      .sort((left, right) => comparePlayers(left, right, opts)),
  );
}

function comparePlayers(
  left: Player,
  right: Player,
  opts?: OrderedPlayersOptions,
) {
  const priorityDifference =
    getPlayerPriority(left, opts) - getPlayerPriority(right, opts);
  if (priorityDifference !== 0) return priorityDifference;

  return left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  });
}

function getPlayerPriority(player: Player, opts?: OrderedPlayersOptions) {
  if (
    toValue(opts?.selectedPlayerFirst ?? true) &&
    player.player_id === store.activePlayerId
  ) {
    return 0;
  }
  if (isBuiltinPlayer(player)) return 1;
  if (
    toValue(opts?.activePlayersFirst ?? true) &&
    isPrioritizedActivePlayer(player, opts)
  ) {
    return 2;
  }
  return 3;
}

function isPrioritizedActivePlayer(
  player: Player,
  opts?: OrderedPlayersOptions,
) {
  if (opts?.includePausedAsActive) return isPlayerActive(player);
  return player.playback_state === PlaybackState.PLAYING;
}
