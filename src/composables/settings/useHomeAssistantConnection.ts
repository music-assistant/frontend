import {
  HASS_DOMAIN,
  HASS_PLAYERS_DOMAIN,
  hassConnectionState,
} from "@/helpers/home_assistant";
import { startAddProvider } from "@/helpers/provider_add";
import { isProviderErrorStatus } from "@/helpers/provider_config";
import { useRemoteAccess } from "@/composables/useRemoteAccess";
import { api } from "@/plugins/api";
import {
  EventType,
  type ProviderConfig,
  ProviderStatus,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import type { SetupFlowEndedCallback } from "@/plugins/eventbus";
import { useDebounceFn } from "@vueuse/core";
import { computed, onBeforeUnmount, ref, watch } from "vue";

// provider updates come in bursts, so a burst reloads the configs once
const RELOAD_DELAY_MS = 300;

/**
 * The connection with Home Assistant and what it provides, kept in step with
 * the server: the Home Assistant provider, the provider of its players and
 * remote access.
 */
export function useHomeAssistantConnection() {
  const hassConfig = ref<ProviderConfig>();
  const playersConfig = ref<ProviderConfig>();
  // its details are read only for a user who may manage remote access
  const remoteAccess = useRemoteAccess();
  const loaded = ref(false);
  const loadFailed = ref(false);
  // whether the players of Home Assistant are being chosen
  const choosingPlayers = ref(false);
  // a provider of players that was just added offers its players to choose
  // once it runs
  let chooseOnceRunning = false;
  let requestId = 0;

  const state = computed(() => hassConnectionState(hassConfig.value));

  /**
   * Start setting up the Home Assistant provider.
   */
  const connect = function () {
    addProvider(HASS_DOMAIN);
  };

  /**
   * Start setting up the provider of the Home Assistant players, and offer its
   * players to choose once it runs.
   */
  const addPlayers = function () {
    addProvider(HASS_PLAYERS_DOMAIN, (finished) => {
      if (!finished) return;
      if (playersConfig.value?.status === ProviderStatus.LOADED) {
        choosingPlayers.value = true;
      } else {
        chooseOnceRunning = true;
      }
    });
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

  const addProvider = function (
    domain: string,
    onFlowEnded?: SetupFlowEndedCallback,
  ) {
    const manifest = api.providerManifests[domain];
    if (manifest) startAddProvider(manifest, undefined, onFlowEnded);
  };

  void load();
  const unsubProvidersUpdated = api.subscribe(
    EventType.PROVIDERS_UPDATED,
    useDebounceFn(load, RELOAD_DELAY_MS),
  );
  onBeforeUnmount(unsubProvidersUpdated);

  // only a connection that is set up has remote access to show
  watch(
    () => !!hassConfig.value && authManager.hasScope(Scope.SYSTEM_MANAGE),
    (needed, wasNeeded) => {
      if (needed && !wasNeeded) void remoteAccess.load();
    },
  );

  watch(
    () => playersConfig.value?.status,
    (status) => {
      if (!chooseOnceRunning || !status) return;
      if (status === ProviderStatus.LOADED) {
        chooseOnceRunning = false;
        choosingPlayers.value = true;
      } else if (isProviderErrorStatus(status)) {
        chooseOnceRunning = false;
      }
    },
  );

  return {
    hassConfig,
    playersConfig,
    remoteAccess,
    loaded,
    loadFailed,
    state,
    choosingPlayers,
    connect,
    addPlayers,
  };
}
