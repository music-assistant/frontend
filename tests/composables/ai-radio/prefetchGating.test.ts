import { reactive } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderInstance } from "@/plugins/api/interfaces";
import { ProviderType } from "@/plugins/api/interfaces";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale.replaceAll("_", "-"),
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

const aiRadioProvider: ProviderInstance = {
  type: ProviderType.PLUGIN,
  domain: "ai_radio",
  name: "AI Radio",
  instance_id: "ai_radio",
  supported_features: [],
  available: true,
  is_streaming_provider: null,
};

/** Mocks @/plugins/api and @/plugins/auth for a fresh module import, returning the api spies. */
async function mockApiAndAuth(guestSessionKind: string | null) {
  const providers = reactive<Record<string, ProviderInstance>>({
    ai_radio: aiRadioProvider,
  });
  const sendCommand = vi.fn().mockResolvedValue({});
  const subscribeMulti = vi.fn(() => () => undefined);
  const api = { providers, sendCommand, subscribe_multi: subscribeMulti };

  vi.doMock("@/plugins/api", () => ({ api, default: api }));
  vi.doMock("@/plugins/auth", () => ({
    authManager: { guestSessionKind: () => guestSessionKind },
    default: { guestSessionKind: () => guestSessionKind },
  }));

  return { sendCommand, subscribeMulti };
}

/** Lets the module-level watcher's synchronous callback finish its async prefetch work. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("ai_radio prefetch gating for session-scoped sessions", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/plugins/api");
    vi.doUnmock("@/plugins/auth");
    vi.doUnmock("@/plugins/i18n");
  });

  it("sends no ai_radio commands and tracks no queue events for a session-scoped session", async () => {
    vi.resetModules();
    const { sendCommand, subscribeMulti } = await mockApiAndAuth("dashboard");

    await import("@/composables/ai-radio/useShows");
    await import("@/composables/ai-radio/useHosts");
    await flushMicrotasks();

    expect(sendCommand).not.toHaveBeenCalled();
    expect(subscribeMulti).not.toHaveBeenCalled();
  });

  it("prefetches ai_radio state and tracks queue events for a regular session", async () => {
    vi.resetModules();
    const { sendCommand, subscribeMulti } = await mockApiAndAuth(null);

    await import("@/composables/ai-radio/useShows");
    await import("@/composables/ai-radio/useHosts");
    await flushMicrotasks();

    const calledCommands = sendCommand.mock.calls.map((call) => call[0]);
    expect(calledCommands).toEqual(
      expect.arrayContaining([
        "ai_radio/stations/list",
        "ai_radio/hosts/list",
        "ai_radio/queue_dj/status",
      ]),
    );
    // The DJ status is kept fresh from queue events rather than polled.
    expect(subscribeMulti).toHaveBeenCalledTimes(1);
  });
});
