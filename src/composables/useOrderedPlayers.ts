import { playerVisible } from "@/helpers/players";
import { api } from "@/plugins/api";
import { computed } from "vue";

interface OrderedPlayersOptions {
  allowNeedsSetup?: boolean;
  allowSources?: boolean;
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
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, {
          sensitivity: "base",
        }),
      ),
  );
}
