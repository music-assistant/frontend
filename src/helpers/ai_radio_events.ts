import api from "@/plugins/api";
import {
  EventType,
  type AIRadioEventName,
  type AIRadioProviderEvent,
} from "@/plugins/api/interfaces";

// the plugin is single instance, so the server uses its domain as instance id
export const AI_RADIO_INSTANCE_ID = "ai_radio";

const EVENT_NAMES: ReadonlySet<string> = new Set<AIRadioEventName>([
  "hosts_updated",
  "stations_updated",
  "sections_updated",
  "queue_dj_updated",
  "sessions_updated",
]);

export function isAIRadioProviderEvent(
  data: unknown,
): data is AIRadioProviderEvent {
  if (typeof data !== "object" || data === null) return false;
  const event = (data as { event?: unknown }).event;
  return typeof event === "string" && EVENT_NAMES.has(event);
}

/** Calls onEvent with the hint name for every ai_radio provider event; returns the unsubscribe handle. */
export function subscribeAIRadioEvents(
  onEvent: (name: AIRadioEventName) => void,
): () => void {
  return api.subscribe(
    EventType.PROVIDER_EVENT,
    (event: { data?: unknown }) => {
      if (isAIRadioProviderEvent(event.data)) onEvent(event.data.event);
    },
    AI_RADIO_INSTANCE_ID,
  );
}
