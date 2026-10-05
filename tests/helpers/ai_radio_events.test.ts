import {
  AI_RADIO_INSTANCE_ID,
  isAIRadioProviderEvent,
  subscribeAIRadioEvents,
} from "@/helpers/ai_radio_events";
import { EventType } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

const { subscribe } = vi.hoisted(() => ({
  subscribe: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: { subscribe },
  api: { subscribe },
}));

describe("isAIRadioProviderEvent", () => {
  it("accepts every refetch hint the server emits", () => {
    for (const event of [
      "hosts_updated",
      "stations_updated",
      "sections_updated",
      "queue_dj_updated",
      "sessions_updated",
    ]) {
      expect(isAIRadioProviderEvent({ event })).toBe(true);
    }
  });

  it("rejects payloads from other plugins and malformed data", () => {
    expect(isAIRadioProviderEvent({ event: "game_updated", state: {} })).toBe(
      false,
    );
    expect(isAIRadioProviderEvent({ event: 1 })).toBe(false);
    expect(isAIRadioProviderEvent(null)).toBe(false);
    expect(isAIRadioProviderEvent("hosts_updated")).toBe(false);
  });
});

describe("subscribeAIRadioEvents", () => {
  it("subscribes to provider events of the ai_radio instance and forwards the hint name", () => {
    const unsubscribe = vi.fn();
    subscribe.mockReturnValue(unsubscribe);
    const onEvent = vi.fn();

    const handle = subscribeAIRadioEvents(onEvent);

    expect(subscribe).toHaveBeenCalledWith(
      EventType.PROVIDER_EVENT,
      expect.any(Function),
      AI_RADIO_INSTANCE_ID,
    );
    const callback = subscribe.mock.calls[0][1] as (event: unknown) => void;
    callback({ object_id: "ai_radio", data: { event: "sessions_updated" } });
    callback({ object_id: "ai_radio", data: { event: "game_updated" } });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith("sessions_updated");
    expect(handle).toBe(unsubscribe);
  });
});
