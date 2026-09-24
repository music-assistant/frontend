import { EventType } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    // held on the mock so the tests can prove the composable reads the loaded
    // plugins rather than scanning the raw provider list again
    providers: {} as Record<string, { domain: string }>,
    sendCommand: vi.fn(),
    subscribe: vi.fn(
      (_event: EventType, _callback: () => Promise<void>) => () => {},
    ),
  },
  storeMock: { enabledPlugins: new Set<string>() },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

const { usePartyConfig } = await import("@/composables/usePartyConfig");

// The composable subscribes once, on the first call, and keeps its config
// module-level; every test drives that same pair of handlers.
const { config, loaded, invalidate } = usePartyConfig();
const onProvidersUpdated = getHandler(EventType.PROVIDERS_UPDATED);
const onCoreStateUpdated = getHandler(EventType.CORE_STATE_UPDATED);

const PARTY_CONFIG = { party_name: "Kitchen" };

describe("usePartyConfig", () => {
  beforeEach(() => {
    invalidate();
    apiMock.providers = { party: { domain: "party" } };
    apiMock.sendCommand.mockReset().mockResolvedValue(PARTY_CONFIG);
    storeMock.enabledPlugins = new Set(["party"]);
  });

  it("refetches the config when the provider list changes", async () => {
    await onProvidersUpdated();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("party/config");
    expect(config.value).toEqual(PARTY_CONFIG);
    expect(loaded.value).toBe(true);
  });

  it("clears the config without a round-trip once the plugin is gone", async () => {
    await onProvidersUpdated();
    expect(config.value).toEqual(PARTY_CONFIG);
    apiMock.sendCommand.mockClear();
    storeMock.enabledPlugins = new Set();

    await onProvidersUpdated();

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
    expect(config.value).toBeNull();
    expect(loaded.value).toBe(true);
  });

  it("refetches the config when remote access is toggled", async () => {
    await onCoreStateUpdated();

    expect(apiMock.sendCommand).toHaveBeenCalledWith("party/config");
    expect(config.value).toEqual(PARTY_CONFIG);
  });

  it("ignores a core state change while the plugin is gone", async () => {
    storeMock.enabledPlugins = new Set();

    await onCoreStateUpdated();

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });
});

/**
 * The handler the composable registered for an event.
 */
function getHandler(event: EventType): () => Promise<void> {
  const call = apiMock.subscribe.mock.calls.find(([subscribed]) => {
    return subscribed === event;
  });
  if (!call) throw new Error(`No subscriber for ${event}`);
  return call[1];
}
