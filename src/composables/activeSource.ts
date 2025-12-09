import { computed, ComputedRef, Ref } from "vue";
import { Player, PlayerSource } from "@/plugins/api/interfaces";

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
    if (!playerObj?.active_source || !playerObj?.source_list) return undefined;
    return playerObj.source_list.find(
      (source) => source.id === playerObj.active_source,
    );
  });

  return { activeSource };
}
