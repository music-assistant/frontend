import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { ProviderInstance } from "@/plugins/api/interfaces";
import { ProviderType } from "@/plugins/api/interfaces";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import api from "@/plugins/api";

const { guestSessionKind, sendCommand, providers } = vi.hoisted(() => ({
  guestSessionKind: vi.fn(() => "dashboard" as string | null),
  sendCommand: vi.fn().mockResolvedValue({}),
  providers: {} as Record<string, ProviderInstance>,
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await import("vue");
  const api = { providers: reactive(providers), sendCommand };
  return { api, default: api };
});

vi.mock("@/plugins/auth", () => ({
  authManager: { guestSessionKind },
  default: { guestSessionKind },
}));

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

const prefetchCommands = [
  "ai_radio/stations/list",
  "ai_radio/status",
  "ai_radio/hosts/list",
  "ai_radio/queue_dj/status",
];

const flushWatcher = async () => {
  await flushPromises();
  await flushPromises();
};

const calledCommands = () =>
  sendCommand.mock.calls.map((call) => call[0]).sort();

afterEach(() => {
  for (const providerId of Object.keys(api.providers)) {
    delete api.providers[providerId];
  }
  sendCommand.mockReset();
  sendCommand.mockResolvedValue({});
  guestSessionKind.mockReset();
  guestSessionKind.mockReturnValue("dashboard");
});

describe("ai_radio prefetch gating for session-scoped sessions", () => {
  it("gates prefetches by provider and session, and retries after failure", async () => {
    // Importing the composables once avoids rebuilding their dependency graph
    // for each session kind while still exercising their module-level watchers.
    // This file has one integration scenario because the prefetch guards are
    // intentionally module-singleton state; the policy matrix is unit-tested
    // independently in src/helpers/ai_radio_prefetch.test.ts.
    useShows();
    useHosts();

    api.providers.spotify = {
      domain: "spotify",
      available: true,
    } as ProviderInstance;
    await flushWatcher();

    api.providers.ai_radio = { ...aiRadioProvider, available: false };
    await flushWatcher();

    expect(sendCommand).not.toHaveBeenCalled();

    // A session-scoped token must not prefetch even when the provider becomes
    // available. The auth value is token-derived and is intentionally sampled
    // at the provider-availability edge.
    api.providers.ai_radio.available = true;
    await flushWatcher();
    expect(sendCommand).not.toHaveBeenCalled();

    // A regular session prefetches the exact four cache requests once. Make
    // every request in the first attempt fail so both composables' guards are
    // reset and permit a later availability edge to retry.
    const commandsToFail = new Set(prefetchCommands);
    sendCommand.mockImplementation(async (command: string) => {
      if (commandsToFail.delete(command)) {
        throw new Error("prefetch failed");
      }
      return {};
    });
    guestSessionKind.mockReturnValue(null);
    delete api.providers.ai_radio;
    await flushWatcher();
    api.providers.ai_radio = aiRadioProvider;
    await flushWatcher();
    expect(calledCommands()).toEqual([...prefetchCommands].sort());

    sendCommand.mockClear();
    delete api.providers.ai_radio;
    await flushWatcher();
    api.providers.ai_radio = aiRadioProvider;
    await flushWatcher();

    expect(calledCommands()).toEqual([...prefetchCommands].sort());
  });
});
