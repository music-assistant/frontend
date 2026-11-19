import { api } from "@/plugins/api";
import {
  type AIEngine,
  type AIEngineUsage,
  EventType,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { useDebounceFn } from "@vueuse/core";
import { onBeforeUnmount, ref } from "vue";

// provider updates come in bursts, so a burst reloads the engines once
const RELOAD_DELAY_MS = 300;

/**
 * The available AI engines and the engine settings that use them, kept in step
 * with the server. Nothing loads for a user who may not read them.
 */
export function useAIEngines() {
  const engines = ref<AIEngine[]>([]);
  const usage = ref<AIEngineUsage[]>([]);
  const loaded = ref(false);
  const loadFailed = ref(false);
  let requestId = 0;

  /**
   * Load the engines and their usage again, for a change the server sends no
   * event for, such as a saved default engine.
   */
  const refresh = async function (): Promise<void> {
    // only the latest request of a burst may set the engines
    const id = ++requestId;
    try {
      const [allEngines, allUsage] = await Promise.all([
        api.getAIEngines(),
        api.getAIUsage(),
      ]);
      if (id !== requestId) return;
      engines.value = allEngines;
      usage.value = allUsage;
      loaded.value = true;
    } catch {
      // the api reports the failure itself; a page that loaded keeps what it has
      if (id === requestId) loadFailed.value = !loaded.value;
    }
  };

  if (authManager.hasScope(Scope.CONFIG_CORE_READ)) {
    void refresh();
    // the engines come and go with the plugins providing them
    const unsubProvidersUpdated = api.subscribe(
      EventType.PROVIDERS_UPDATED,
      useDebounceFn(refresh, RELOAD_DELAY_MS),
    );
    onBeforeUnmount(unsubProvidersUpdated);
  }

  return { engines, usage, loaded, loadFailed, refresh };
}
