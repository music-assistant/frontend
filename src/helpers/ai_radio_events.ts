import api, { ConnectionState } from "@/plugins/api";
import { EventType, type AIRadioEventName } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { watch } from "vue";

// the plugin is single instance, so the server uses its domain as instance id
const AI_RADIO_INSTANCE_ID = "ai_radio";

const loaders = new Map<AIRadioEventName, () => Promise<unknown>>();
let watching = false;

/** The hint named `name`, a reconnect, or the plugin coming back refetches through `loader`. */
export function trackAIRadioCache(
  name: AIRadioEventName,
  loader: () => Promise<unknown>,
): void {
  loaders.set(name, loader);
  if (watching) return;
  watching = true;

  let unsubscribe: (() => void) | undefined;
  watch(
    () => store.enabledPlugins.has("ai_radio"),
    (available, wasAvailable) => {
      unsubscribe?.();
      unsubscribe = available
        ? api.subscribe(
            EventType.PROVIDER_EVENT,
            onProviderEvent,
            AI_RADIO_INSTANCE_ID,
          )
        : undefined;
      // not on the first run: the loader that got us here has just fetched
      if (available && wasAvailable === false) refetchAll();
    },
    { immediate: true },
  );

  // hints emitted while the socket was down are lost
  watch(
    () => api.state.value,
    (state) => {
      if (state === ConnectionState.INITIALIZED) refetchAll();
    },
  );
}

function onProviderEvent(event: { data?: unknown }): void {
  const name = (event.data as { event?: string } | undefined)?.event;
  const loader = name && loaders.get(name as AIRadioEventName);
  if (loader) void loader().catch(() => undefined);
}

function refetchAll(): void {
  for (const loader of loaders.values()) void loader().catch(() => undefined);
}
