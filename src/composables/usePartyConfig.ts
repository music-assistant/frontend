/**
 * Shared composable for party configuration.
 * Fetches party/config once and shares reactive state across components,
 * avoiding redundant API calls when multiple components need the same config.
 */

import { ref } from "vue";
import api from "@/plugins/api";
import { EventType, type PartyConfig } from "@/plugins/api/interfaces";

const config = ref<PartyConfig | null>(null);
const loading = ref(false);
const loaded = ref(false);

let fetchPromise: Promise<PartyConfig | null> | null = null;

/**
 * Fetch party config, deduplicating concurrent requests.
 * Returns the cached config if already loaded, unless force is true.
 */
async function fetchConfig(force = false): Promise<PartyConfig | null> {
  if (loaded.value && !force) {
    return config.value;
  }

  // Deduplicate concurrent fetches
  if (fetchPromise && !force) {
    return fetchPromise;
  }

  loading.value = true;
  fetchPromise = (async () => {
    try {
      const result = (await api.sendCommand("party/config")) as PartyConfig;
      config.value = result;
      loaded.value = true;
      return result;
    } catch {
      config.value = null;
      loaded.value = true;
      return null;
    } finally {
      loading.value = false;
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Reset cached config (e.g., when provider is reloaded).
 */
function invalidate() {
  config.value = null;
  loaded.value = false;
  fetchPromise = null;
}

let subscribed = false;

/**
 * Subscribe to PROVIDERS_UPDATED and CORE_STATE_UPDATED so the shared
 * config ref auto-refreshes whenever the party provider is reloaded
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
      invalidate();
      await fetchConfig(true);
    } else {
      config.value = null;
      loaded.value = true;
    }
  });

  // Remote access toggle fires CORE_STATE_UPDATED; refresh config so the
  // join URL switches between local and remote.
  api.subscribe(EventType.CORE_STATE_UPDATED, async () => {
    const hasParty = Object.values(api.providers).some(
      (p) => p.domain === "party",
    );
    if (hasParty) {
      invalidate();
      await fetchConfig(true);
    }
  });
}

export function usePartyConfig() {
  ensureSubscribed();
  return {
    config,
    loading,
    loaded,
    fetchConfig,
    invalidate,
  };
}
