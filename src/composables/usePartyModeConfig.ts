/**
 * Shared composable for party mode configuration.
 * Fetches party_mode/config once and shares reactive state across components,
 * avoiding redundant API calls when multiple components need the same config.
 */

import { ref } from "vue";
import api from "@/plugins/api";
import type { PartyModeConfig } from "@/plugins/api/interfaces";

const config = ref<PartyModeConfig | null>(null);
const loading = ref(false);
const loaded = ref(false);

let fetchPromise: Promise<PartyModeConfig | null> | null = null;

/**
 * Fetch party mode config, deduplicating concurrent requests.
 * Returns the cached config if already loaded, unless force is true.
 */
async function fetchConfig(
  force = false,
): Promise<PartyModeConfig | null> {
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
      const result = (await api.sendCommand(
        "party_mode/config",
      )) as PartyModeConfig;
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

export function usePartyModeConfig() {
  return {
    config,
    loading,
    loaded,
    fetchConfig,
    invalidate,
  };
}
