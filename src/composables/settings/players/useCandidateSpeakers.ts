import { getPlayerDisplayName } from "@/helpers/players";
import { api } from "@/plugins/api";
import { computed, ref, type Ref } from "vue";

export interface CandidateSpeaker {
  player_id: string;
  name: string;
}

/**
 * The speakers a dialog offers to add to a multi-channel player: those the server lists for
 * the provider, in the order of their names.
 *
 * @param exclude The player id of a speaker the list leaves out.
 */
export function useCandidateSpeakers(exclude: Ref<string | undefined>) {
  // undefined while the list loads
  const candidateIds = ref<string[]>();
  let requestId = 0;

  const candidates = computed<CandidateSpeaker[]>(() =>
    (candidateIds.value ?? [])
      .filter((id) => id !== exclude.value)
      .flatMap((id) => {
        const player = api.players[id];
        return player
          ? [{ player_id: id, name: getPlayerDisplayName(player) }]
          : [];
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
      ),
  );

  const noSpeakers = computed(
    () => candidateIds.value !== undefined && candidates.value.length === 0,
  );

  /** Load the list of a provider (instance), replacing the one shown. */
  async function load(provider: string) {
    const request = ++requestId;
    candidateIds.value = undefined;
    let ids: string[];
    try {
      ids = await api.getMultiChannelCandidates(provider);
    } catch {
      // a failed command is already reported by the api layer
      ids = [];
    }
    // a dialog opened again meanwhile asked for the speakers of another player
    if (request === requestId) candidateIds.value = ids;
  }

  return { candidates, noSpeakers, load };
}
