import { reactive } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderInstance } from "@/plugins/api/interfaces";
import { ProviderType } from "@/plugins/api/interfaces";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../fixtures/scopes";

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

/** Mocks @/plugins/api and @/plugins/auth for a fresh module import, returning the sendCommand spy. */
async function mockApiAndAuth(
  guestSessionKind: string | null,
  scopes: Parameters<typeof scopeChecker>[0] = BUILTIN_ROLE_SCOPES.user,
) {
  const providers = reactive<Record<string, ProviderInstance>>({
    ai_radio: aiRadioProvider,
  });
  const sendCommand = vi.fn().mockResolvedValue({});

  vi.doMock("@/plugins/api", () => ({
    api: { providers, sendCommand },
    default: { providers, sendCommand },
  }));
  const hasScope = scopeChecker(scopes);
  vi.doMock("@/plugins/auth", () => ({
    authManager: { guestSessionKind: () => guestSessionKind, hasScope },
    default: { guestSessionKind: () => guestSessionKind, hasScope },
  }));

  return sendCommand;
}

/** Lets the module-level watcher's synchronous callback finish its async prefetch work. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// every test imports the composables anew after resetting the module registry,
// which can take seconds under load
describe("ai_radio prefetch gating", { timeout: 20_000 }, () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/plugins/api");
    vi.doUnmock("@/plugins/auth");
    vi.doUnmock("@/plugins/i18n");
  });

  it("sends no ai_radio commands for a session-scoped session", async () => {
    vi.resetModules();
    const sendCommand = await mockApiAndAuth("dashboard");

    await import("@/composables/ai-radio/useShows");
    await import("@/composables/ai-radio/useHosts");
    await flushMicrotasks();

    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("sends no ai_radio commands for a role that may not load the hosts", async () => {
    vi.resetModules();
    const sendCommand = await mockApiAndAuth(null, BUILTIN_ROLE_SCOPES.guest);

    await import("@/composables/ai-radio/useShows");
    await import("@/composables/ai-radio/useHosts");
    await flushMicrotasks();

    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("prefetches ai_radio state for a regular session", async () => {
    vi.resetModules();
    const sendCommand = await mockApiAndAuth(null);

    await import("@/composables/ai-radio/useShows");
    await import("@/composables/ai-radio/useHosts");
    await flushMicrotasks();

    const calledCommands = sendCommand.mock.calls.map((call) => call[0]);
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
