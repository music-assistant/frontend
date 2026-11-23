import {
  getCombiningProviders,
  type MultiChannelCandidates,
  type MultiChannelLayouts,
} from "@/helpers/multi_channel";
import { api } from "@/plugins/api";
import type { Player } from "@/plugins/api/interfaces";
import { computed, ref, watch, type Ref } from "vue";

/**
 * The candidate speakers and the layouts of a multi-channel player on each provider of a
 * player that combines speakers, as the server lists them. Fetched when the player shows,
 * and again when its outputs change or it comes or goes.
 *
 * @param player The player whose settings show.
 */
export function useMultiChannelCandidates(player: Ref<Player | undefined>) {
  const candidates = ref<MultiChannelCandidates>({});
  const layouts = ref<Record<string, MultiChannelLayouts>>({});
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
          // only decides what the menus offer, so a failure stays quiet
          const [ids, providerLayouts] = await Promise.all([
            api
              .getMultiChannelCandidates(provider, {
                suppressGlobalError: true,
              })
              .catch(() => []),
            api
              .getMultiChannelLayouts(provider, { suppressGlobalError: true })
              .catch(() => ({})),
          ]);
          return { provider, ids, providerLayouts };
        }),
      );
      if (request !== requestId) return;
      candidates.value = Object.fromEntries(
        lists.map(({ provider, ids }) => [provider, ids]),
      );
      layouts.value = Object.fromEntries(
        lists.map(({ provider, providerLayouts }) => [
          provider,
          providerLayouts,
        ]),
      );
    },
    { immediate: true },
  );

  return { candidates, layouts };
}
