import type { ProviderInstance } from "@/plugins/api/interfaces";
import { ProviderType } from "@/plugins/api/interfaces";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    guestSessionKind: null as string | null,
    sendCommand: vi.fn(),
    setProvider: undefined as
      | ((provider: ProviderInstance | undefined) => void)
      | undefined,
  },
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

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const providers = reactive<Record<string, ProviderInstance>>({});

  mocks.setProvider = (provider) => {
    if (provider) providers.ai_radio = provider;
    else delete providers.ai_radio;
  };
  mocks.sendCommand.mockImplementation((command: string) => {
    if (command === "ai_radio/status") return Promise.resolve({ sessions: [] });
    return Promise.resolve([]);
  });

  return {
    api: { providers, sendCommand: mocks.sendCommand },
    default: { providers, sendCommand: mocks.sendCommand },
  };
});

vi.mock("@/plugins/auth", () => ({
  authManager: {
    guestSessionKind: () => mocks.guestSessionKind,
  },
  default: {
    guestSessionKind: () => mocks.guestSessionKind,
  },
}));

// Import once. Re-importing these modules after vi.resetModules leaves the
// module-level provider watchers from the previous test alive and can stall
// the next dynamic import.
import "@/composables/ai-radio/useShows";
import "@/composables/ai-radio/useHosts";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("ai_radio prefetch gating for session-scoped sessions", () => {
  afterEach(() => {
    mocks.setProvider?.(undefined);
    mocks.guestSessionKind = null;
    mocks.sendCommand.mockClear();
  });

  it("sends no ai_radio commands for a session-scoped session", async () => {
    mocks.guestSessionKind = "dashboard";
    mocks.setProvider?.(aiRadioProvider);
    await flushMicrotasks();

    expect(mocks.sendCommand).not.toHaveBeenCalled();
  });

  it("prefetches ai_radio state for a regular session", async () => {
    mocks.guestSessionKind = null;
    mocks.setProvider?.(aiRadioProvider);
    await flushMicrotasks();

    const calledCommands = mocks.sendCommand.mock.calls.map((call) => call[0]);
    expect(calledCommands).toEqual(
      expect.arrayContaining([
        "ai_radio/stations/list",
        "ai_radio/status",
        "ai_radio/hosts/list",
        "ai_radio/queue_dj/status",
      ]),
    );
  });
});
