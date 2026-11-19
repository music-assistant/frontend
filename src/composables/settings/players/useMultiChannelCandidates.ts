import {
  getCombiningProviders,
  type MultiChannelCandidates,
} from "@/helpers/multi_channel";
import { api } from "@/plugins/api";
import type { Player } from "@/plugins/api/interfaces";
import { computed, ref, watch, type Ref } from "vue";

/**
 * The candidate speakers of a new multi-channel player on each provider of a player that
 * combines speakers, as the server lists them. Fetched when the player shows, and again
 * when its outputs change or it comes or goes.
 *
 * @param player The player whose settings show.
 */
export function useMultiChannelCandidates(player: Ref<Player | undefined>) {
  const candidates = ref<MultiChannelCandidates>({});
  let requestId = 0;

  const fetchKey = computed(() =>
    player.value
      ? JSON.stringify([
          player.value.player_id,
          player.value.available,
          getCombiningProviders(player.value),
        ])
      : "",
  );

  watch(
    fetchKey,
    async () => {
      const providers = player.value ? getCombiningProviders(player.value) : [];
      const request = ++requestId;
      const lists = await Promise.all(
        providers.map(async (provider) => {
          try {
            // only decides whether the menu offers the entry, so a failure stays quiet
            const ids = await api.getMultiChannelCandidates(provider, {
              suppressGlobalError: true,
            });
            return [provider, ids] as const;
          } catch {
            return [provider, []] as const;
          }
        }),
      );
      if (request === requestId) candidates.value = Object.fromEntries(lists);
    },
    { immediate: true },
  );

  return candidates;
}
