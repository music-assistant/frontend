/**
 * Shared composable for party configuration.
 * Fetches party/{instanceId}/config once per instance and shares reactive state
 * across components, avoiding redundant API calls when multiple components need
 * the same config.
 */

import { ref } from "vue";
import api from "@/plugins/api";
import { EventType, type PartyConfig } from "@/plugins/api/interfaces";

// Per-instance cache
const configs = ref<Record<string, PartyConfig | null>>({});
const loadingMap = ref<Record<string, boolean>>({});
const loadedMap = ref<Record<string, boolean>>({});

const fetchPromises: Record<string, Promise<PartyConfig | null> | null> = {};

/**
 * Fetch party config for a specific instance, deduplicating concurrent requests.
 * Returns the cached config if already loaded, unless force is true.
 */
async function fetchConfig(
  instanceId: string,
  force = false,
): Promise<PartyConfig | null> {
  if (loadedMap.value[instanceId] && !force) {
    return configs.value[instanceId] ?? null;
  }

  // Deduplicate concurrent fetches
  if (fetchPromises[instanceId] && !force) {
    return fetchPromises[instanceId]!;
  }

  loadingMap.value[instanceId] = true;
  fetchPromises[instanceId] = (async () => {
    try {
      const result = (await api.sendCommand(
        `party/${instanceId}/config`,
      )) as PartyConfig;
      configs.value[instanceId] = result;
      loadedMap.value[instanceId] = true;
      return result;
    } catch {
      configs.value[instanceId] = null;
      loadedMap.value[instanceId] = true;
      return null;
    } finally {
      loadingMap.value[instanceId] = false;
      delete fetchPromises[instanceId];
    }
  })();

  return fetchPromises[instanceId]!;
}

/**
 * Reset cached config for a specific instance or all instances.
 */
function invalidate(instanceId?: string) {
  if (instanceId) {
    delete configs.value[instanceId];
    delete loadedMap.value[instanceId];
    delete fetchPromises[instanceId];
  } else {
    configs.value = {};
    loadedMap.value = {};
    for (const key of Object.keys(fetchPromises)) {
      delete fetchPromises[key];
    }
  }
}

/**
 * Re-fetch configs for all previously loaded instances.
 * Unlike invalidate(), this updates the reactive state in-place so watchers
 * see the new per-instance values rather than a blanket null.
 */
async function refetchAll() {
  const instanceIds = Object.keys(loadedMap.value);
  await Promise.all(instanceIds.map((id) => fetchConfig(id, true)));
}

let subscribed = false;

/**
 * Subscribe to PROVIDERS_UPDATED and CORE_STATE_UPDATED so the shared
 * config ref auto-refreshes whenever any party provider is reloaded
 * or remote access is toggled.
 */
function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;

  api.subscribe(EventType.PROVIDERS_UPDATED, async () => {
    const hasParty = Object.values(api.providers).some(
      (p) => p.domain === "party",
    );
    if (hasParty) {
      await refetchAll();
    } else {
      configs.value = {};
      loadedMap.value = {};
    }
  });

  // Remote access toggle fires CORE_STATE_UPDATED; refresh config so the
  // join URL switches between local and remote.
  api.subscribe(EventType.CORE_STATE_UPDATED, async () => {
    const hasParty = Object.values(api.providers).some(
      (p) => p.domain === "party",
    );
    if (hasParty) {
      await refetchAll();
    }
  });
}

export function usePartyConfig(instanceId?: string) {
  ensureSubscribed();
  return {
    config: configs,
    loading: loadingMap,
    loaded: loadedMap,
    fetchConfig: (force = false) => {
      if (instanceId) {
        return fetchConfig(instanceId, force);
      }
      return Promise.resolve(null);
    },
    fetchConfigForInstance: fetchConfig,
    invalidate,
  };
}
