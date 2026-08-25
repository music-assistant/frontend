import { computed, ComputedRef, Ref } from "vue";
import { Player, PlayerSource } from "@/plugins/api/interfaces";

/**
 * The id of the source a player is playing, as the server resolves it.
 *
 * Music Assistant's own queue is listed under the player's own id, so that is
 * the answer when nothing has taken the player over. A player hearing its sync
 * leader or group reports that leader's source, which is also what a command
 * issued to it applies to.
 *
 * Pass this to a command that names the source it is aimed at, so it cannot
 * land on whatever took the player since. It answers from the player alone, so
 * state read off a queue has to come from the queue playing on that player.
 */
export function resolveActiveSourceId(player: Player): string {
  return player.active_source || player.player_id;
}

/**
 * Composable to get the active source from a player
 */
export function useActiveSource(
  player:
    | ComputedRef<Player | undefined>
    | Ref<Player | undefined>
    | Player
    | undefined,
) {
  const activeSource = computed((): PlayerSource | undefined => {
    const playerObj =
      typeof player === "object" && "value" in player ? player.value : player;
    if (!playerObj?.source_list) return undefined;
    const activeSourceId = resolveActiveSourceId(playerObj);
    return playerObj.source_list.find((source) => source.id === activeSourceId);
  });

  return { activeSource };
}
