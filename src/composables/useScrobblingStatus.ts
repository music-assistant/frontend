import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import api from "@/plugins/api";
import {
  EventType,
  ProviderStatus,
  type ProviderConfig,
  type PlayerConfig,
  type ConfigEntry,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

export type ScrobblingState = "ready";

export interface ScrobblingStatus {
  configured: boolean;
  state: ScrobblingState | null;
  providerNames: string[];
}

const SCROBBLING_HINT = /scrobbl|listen.?brainz/i;
const PROVIDER_LABELS: Record<string, string> = {
  lastfm_scrobble: "Last.fm",
  listenbrainz: "ListenBrainz",
  listenbrainz_scrobble: "ListenBrainz",
  subsonic_scrobble: "Subsonic",
};

const textForProvider = (provider: ProviderConfig) =>
  [
    provider.domain,
    provider.name,
    provider.default_name,
    ...Object.entries(provider.values).flatMap(([key, entry]) => [
      key,
      entry.label,
    ]),
  ]
    .filter((value): value is string => !!value)
    .join(" ");

export const isScrobblingProvider = (provider: ProviderConfig) => {
  const scrobbleEntryEnabled = Object.entries(provider.values).some(
    ([key, entry]) =>
      SCROBBLING_HINT.test(`${key} ${entry.label ?? ""}`) &&
      entry.value === true,
  );

  return (
    SCROBBLING_HINT.test(textForProvider(provider)) || scrobbleEntryEnabled
  );
};

export const getScrobblingProviderName = (provider: ProviderConfig) =>
  PROVIDER_LABELS[provider.domain] ||
  provider.name ||
  provider.default_name ||
  provider.domain;

const selectedIdsInclude = (
  values: Record<string, ConfigEntry>,
  key: "scrobble_users" | "scrobble_players",
  id: string | undefined,
) => {
  if (!id) return false;
  const value = values[key]?.value;
  return (
    !Array.isArray(value) || value.length === 0 || value.some((x) => x === id)
  );
};

const playerScrobblingEnabled = (
  player: PlayerConfig | undefined,
  playerId: string | undefined,
) => {
  if (!playerId || !player || player.enabled === false) return false;
  return true;
};

export const getScrobblingStatus = (
  providers: ProviderConfig[],
  userId?: string,
  playerConfig?: PlayerConfig,
): ScrobblingStatus => {
  const scrobblers = providers.filter(
    (provider) =>
      isScrobblingProvider(provider) &&
      provider.enabled &&
      (!provider.status || provider.status === ProviderStatus.LOADED) &&
      selectedIdsInclude(provider.values, "scrobble_users", userId) &&
      selectedIdsInclude(
        provider.values,
        "scrobble_players",
        playerConfig?.player_id,
      ) &&
      playerScrobblingEnabled(playerConfig, playerConfig?.player_id),
  );
  if (!scrobblers.length) {
    return { configured: false, state: null, providerNames: [] };
  }

  return {
    configured: true,
    state: "ready",
    providerNames: scrobblers.map(getScrobblingProviderName),
  };
};

export function useScrobblingStatus() {
  const providerConfigs = ref<ProviderConfig[]>([]);
  const playerConfigs = ref<PlayerConfig[]>([]);
  let unsubscribe: (() => void) | undefined;

  const refresh = async () => {
    try {
      const [providers, players] = await Promise.all([
        api.getProviderConfigs(),
        api.getPlayerConfigs(undefined, true, true, true),
      ]);
      providerConfigs.value = providers;
      playerConfigs.value = players;
    } catch {
      providerConfigs.value = [];
      playerConfigs.value = [];
    }
  };

  onMounted(() => {
    void refresh();
    unsubscribe = api.subscribe_multi(
      [EventType.PROVIDERS_UPDATED, EventType.PLAYER_CONFIG_UPDATED],
      refresh,
    );
  });

  onBeforeUnmount(() => unsubscribe?.());

  const status = computed(() =>
    getScrobblingStatus(
      providerConfigs.value,
      store.currentUser?.user_id,
      playerConfigs.value.find(
        (player) => player.player_id === store.activePlayerId,
      ),
    ),
  );
  const providerSummary = computed(() => {
    const names = status.value.providerNames;
    if (names.length <= 2) return names.join(" + ");
    return `${names.length} services`;
  });

  return { status, providerSummary, refresh };
}
