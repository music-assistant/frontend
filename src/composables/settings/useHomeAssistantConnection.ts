import {
  HASS_DOMAIN,
  HASS_PLAYERS_DOMAIN,
  hassConnectionState,
} from "@/helpers/home_assistant";
import { startAddProvider } from "@/helpers/provider_add";
import { api } from "@/plugins/api";
import {
  EventType,
  type ProviderConfig,
  type RemoteAccessInfo,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { useDebounceFn } from "@vueuse/core";
import { computed, onBeforeUnmount, ref, watch } from "vue";

// provider updates come in bursts, so a burst reloads the configs once
const RELOAD_DELAY_MS = 300;

/**
 * The connection with Home Assistant and what it provides, kept in step with
 * the server: the Home Assistant provider, the provider of its players and how
 * remote access runs.
 */
export function useHomeAssistantConnection() {
  const hassConfig = ref<ProviderConfig>();
  const playersConfig = ref<ProviderConfig>();
  // unknown until it loads, and for a user who may not manage remote access
  const remoteAccess = ref<RemoteAccessInfo>();
  const loaded = ref(false);
  const loadFailed = ref(false);
  let requestId = 0;

  const state = computed(() => hassConnectionState(hassConfig.value));

  /**
   * Start setting up the Home Assistant provider.
   */
  const connect = function () {
    addProvider(HASS_DOMAIN);
  };

  /**
   * Start setting up the provider of the Home Assistant players.
   */
  const addPlayers = function () {
    addProvider(HASS_PLAYERS_DOMAIN);
  };

  const load = async function () {
    // only the latest request of a burst may set the configs
    const id = ++requestId;
    try {
      const [hass, players] = await Promise.all([
        api.getProviderConfigs(undefined, HASS_DOMAIN),
        api.getProviderConfigs(undefined, HASS_PLAYERS_DOMAIN),
      ]);
      if (id !== requestId) return;
      hassConfig.value = hass[0];
      playersConfig.value = players[0];
      loaded.value = true;
    } catch {
      // the api reports the failure itself; a page that loaded keeps what it has
      if (id === requestId) loadFailed.value = !loaded.value;
    }
  };

  const loadRemoteAccess = async function () {
    try {
      remoteAccess.value = await api.getRemoteAccessInfo();
    } catch {
      // the api reports the failure itself
    }
  };

  const addProvider = function (domain: string) {
    const manifest = api.providerManifests[domain];
    if (manifest) startAddProvider(manifest);
  };

  void load();
  const unsubProvidersUpdated = api.subscribe(
    EventType.PROVIDERS_UPDATED,
    useDebounceFn(load, RELOAD_DELAY_MS),
  );
  onBeforeUnmount(unsubProvidersUpdated);

  // only a connection that is set up has remote access to show
  watch(
    () =>
      !!hassConfig.value &&
      !remoteAccess.value &&
      authManager.hasScope(Scope.SYSTEM_MANAGE),
    (needed) => {
      if (needed) void loadRemoteAccess();
    },
  );

  return {
    hassConfig,
    playersConfig,
    remoteAccess,
    loaded,
    loadFailed,
    state,
    connect,
    addPlayers,
  };
}
