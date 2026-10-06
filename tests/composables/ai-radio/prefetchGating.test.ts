import { flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderInstance } from "@/plugins/api/interfaces";
import { EventType, ProviderType, Scope } from "@/plugins/api/interfaces";
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

/** Mocks @/plugins/api and @/plugins/auth for a fresh module import, returning the api spies. */
async function mockApiAndAuth(
  guestSessionKind: string | null,
  scopes: Parameters<typeof scopeChecker>[0] = BUILTIN_ROLE_SCOPES.user,
) {
  const providers = reactive<Record<string, ProviderInstance>>({
    ai_radio: aiRadioProvider,
  });
  const sendCommand = vi.fn().mockResolvedValue({});
  const providerEventListeners: Array<(event: unknown) => void> = [];
  // a successful load registers its cache for provider events, which reads these
  const subscribe = vi.fn(
    (_event: EventType, callback: (event: unknown) => void) => {
      providerEventListeners.push(callback);
      return () => {};
    },
  );
  const subscribeMulti = vi.fn(() => () => {});
  const api = {
    providers,
    sendCommand,
    subscribe,
    subscribe_multi: subscribeMulti,
    state: { value: "initialized" },
  };

  vi.doMock("@/plugins/api", () => ({ api, default: api }));
  const hasScope = scopeChecker(scopes);
  vi.doMock("@/plugins/auth", () => ({
    authManager: { guestSessionKind: () => guestSessionKind, hasScope },
    default: { guestSessionKind: () => guestSessionKind, hasScope },
  }));

  const emitProviderEvent = (data: unknown) => {
    for (const listener of providerEventListeners)
      listener({ object_id: "ai_radio", data });
  };
  return { sendCommand, subscribe, subscribeMulti, emitProviderEvent };
}

async function importComposables() {
  await import("@/composables/ai-radio/useShows");
  await import("@/composables/ai-radio/useHosts");
  await flushPromises();
}

describe("ai_radio prefetch gating", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/plugins/api");
    vi.doUnmock("@/plugins/auth");
    // i18n stays mocked, the real one would load every locale on the next import
  });

  it("sends no ai_radio commands and subscribes to nothing for a session-scoped session", async () => {
    vi.resetModules();
    const { sendCommand, subscribe, subscribeMulti } =
      await mockApiAndAuth("dashboard");

    await importComposables();

    expect(sendCommand).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(subscribeMulti).not.toHaveBeenCalled();
  });

  it("fetches the on-air state but loads no hosts for a role that may not read the plugin settings", async () => {
    vi.resetModules();
    const { sendCommand } = await mockApiAndAuth(
      null,
      BUILTIN_ROLE_SCOPES.guest,
    );

    await importComposables();

    const calledCommands = sendCommand.mock.calls.map((call) => call[0]);
    expect(calledCommands).toContain("ai_radio/queue_dj/status");
    expect(calledCommands).not.toContain("ai_radio/hosts/list");
  });

  it("sends no ai_radio commands for a role that may not control queues", async () => {
    vi.resetModules();
    const { sendCommand, subscribe } = await mockApiAndAuth(
      null,
      BUILTIN_ROLE_SCOPES.guest.filter(
        (scope) => scope !== Scope.QUEUES_CONTROL,
      ),
    );

    await importComposables();

    expect(sendCommand).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("prefetches ai_radio state for a regular session without tracking queue events", async () => {
    vi.resetModules();
    const { sendCommand, subscribe, subscribeMulti } =
      await mockApiAndAuth(null);

    await importComposables();

    const calledCommands = sendCommand.mock.calls.map((call) => call[0]);
    expect(calledCommands).toEqual(
      expect.arrayContaining([
        "ai_radio/hosts/list",
        "ai_radio/queue_dj/status",
      ]),
    );
    expect(subscribeMulti).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(
      EventType.PROVIDER_EVENT,
      expect.any(Function),
      "ai_radio",
    );
  });

  it("refetches the on-air state when the server hints the queue DJ changed", async () => {
    vi.resetModules();
    const { sendCommand, emitProviderEvent } = await mockApiAndAuth(
      null,
      BUILTIN_ROLE_SCOPES.guest,
    );
    await importComposables();
    sendCommand.mockClear();

    emitProviderEvent({ event: "queue_dj_updated" });
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendCommand).toHaveBeenCalledWith(
      "ai_radio/queue_dj/status",
      undefined,
      { suppressGlobalError: true },
    );
  });
});
