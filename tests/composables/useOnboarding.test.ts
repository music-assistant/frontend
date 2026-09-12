import { ProviderType } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  authMock,
  preferenceState,
  providerConfigs,
  routerMock,
  setUserPreferenceMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, { builtin: boolean; name: string }>,
    getProviderConfigs: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: { value: undefined as { onboard_done: boolean } | undefined },
  },
  authMock: { isAdmin: vi.fn(() => true) },
  // replaced with a real ref by the userPreferences mock factory below, so
  // the composable's computed context follows what a test sets here
  preferenceState: { intent: { value: undefined } as { value?: string } },
  // what the server hands back as the provider configurations
  providerConfigs: { list: [] as Record<string, unknown>[] },
  routerMock: { replace: vi.fn(), push: vi.fn() },
  setUserPreferenceMock: vi.fn(),
  toastMock: { error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  preferenceState.intent = ref<string | undefined>(undefined);
  return {
    setUserPreference: setUserPreferenceMock,
    useUserPreferences: () => ({
      getPreference: () => preferenceState.intent,
    }),
  };
});

type OnboardingModule = typeof import("@/composables/useOnboarding");
type Onboarding = ReturnType<OnboardingModule["useOnboarding"]>;

/** A fresh singleton per test: the dismissed flag lives for a whole session. */
async function loadModule(): Promise<OnboardingModule> {
  vi.resetModules();
  return await import("@/composables/useOnboarding");
}

/** The composable with the provider configurations already in. */
async function loadOnboarding(): Promise<Onboarding> {
  const onboarding = (await loadModule()).useOnboarding();
  await onboarding.loadProviderConfigs();
  return onboarding;
}

function addProvider(
  instanceId: string,
  domain: string,
  type: ProviderType,
  options: { builtin?: boolean; enabled?: boolean; lastError?: unknown } = {},
) {
  providerConfigs.list.push({
    instance_id: instanceId,
    domain,
    type,
    name: null,
    enabled: options.enabled ?? true,
    last_error: options.lastError ?? null,
  });
  apiMock.providerManifests[domain] = {
    builtin: options.builtin ?? false,
    name: `${domain} manifest`,
  };
}

/**
 * An error as the api client rejects with, from the module registry the
 * composable was just loaded from: a reset registry hands out a fresh class, so
 * only this one answers its `instanceof` check. Call after `loadOnboarding`.
 */
async function apiCommandError(code: number, message = "nope") {
  const { ApiCommandError } = await import("@/plugins/api/errors");
  return new ApiCommandError(message, code);
}

const SERVERS_THAT_NEED_NO_COMMAND: [
  string,
  { onboard_done: boolean } | undefined,
][] = [
  ["already completed onboarding itself", { onboard_done: true }],
  ["did not say either way", undefined],
];

let warnSpy: ReturnType<typeof vi.spyOn>;

describe("useOnboarding", () => {
  beforeEach(() => {
    apiMock.players = {};
    apiMock.providerManifests = {};
    providerConfigs.list = [];
    apiMock.getProviderConfigs.mockReset();
    apiMock.getProviderConfigs.mockImplementation(async () => [
      ...providerConfigs.list,
    ]);
    apiMock.subscribe.mockClear();
    apiMock.sendCommand.mockReset();
    apiMock.sendCommand.mockResolvedValue(undefined);
    apiMock.serverInfo.value = { onboard_done: false };
    authMock.isAdmin.mockReturnValue(true);
    routerMock.replace.mockReset();
    setUserPreferenceMock.mockReset();
    toastMock.error.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    preferenceState.intent.value = undefined;
  });

  it("reads the context from the provider configurations", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    addProvider("builtin--1", "builtin_player", ProviderType.PLAYER, {
      builtin: true,
    });
    apiMock.players = { player_1: {}, player_2: {} };

    const { ctx, pending, hasPending } = await loadOnboarding();

    expect(ctx.value.playerCount).toBe(2);
    expect(ctx.value.providers).toEqual([
      {
        type: ProviderType.MUSIC,
        domain: "spotify",
        builtin: false,
        enabled: true,
      },
      {
        type: ProviderType.PLAYER,
        domain: "builtin_player",
        builtin: true,
        enabled: true,
      },
    ]);
    // the builtin player provider does not tick the players step off
    expect(pending.value.map((step) => step.id)).toEqual([
      "intent",
      "players",
      "plugins",
    ]);
    expect(hasPending.value).toBe(true);
  });

  it("decides nothing before the configurations are in", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { ctx, configsLoaded, loadProviderConfigs } = (
      await loadModule()
    ).useOnboarding();

    expect(configsLoaded.value).toBe(false);
    expect(ctx.value.providers).toEqual([]);
    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();

    await loadProviderConfigs();

    expect(configsLoaded.value).toBe(true);
    expect(ctx.value.providers).toHaveLength(1);
  });

  it("asks for the configurations once while a load is in flight", async () => {
    let handOverConfigs: (configs: unknown[]) => void = () => {};
    apiMock.getProviderConfigs.mockImplementation(
      () =>
        new Promise((resolve) => {
          handOverConfigs = resolve;
        }),
    );

    const { configsLoaded, loadProviderConfigs } = (
      await loadModule()
    ).useOnboarding();
    const both = Promise.all([loadProviderConfigs(), loadProviderConfigs()]);

    expect(apiMock.getProviderConfigs).toHaveBeenCalledOnce();

    handOverConfigs([]);
    await both;

    expect(configsLoaded.value).toBe(true);
    // one session, one subscription, however many callers there are
    expect(apiMock.subscribe).toHaveBeenCalledOnce();
  });

  it("follows the provider configurations the server reports", async () => {
    const { ctx } = await loadOnboarding();
    expect(ctx.value.providers).toEqual([]);

    const [event, onProvidersUpdated] = apiMock.subscribe.mock
      .calls[0] as unknown as [string, () => void];
    expect(event).toBe("providers_updated");

    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    onProvidersUpdated();
    await vi.waitFor(() => expect(ctx.value.providers).toHaveLength(1));
  });

  it("keeps waiting when the configurations cannot be loaded", async () => {
    apiMock.getProviderConfigs.mockRejectedValue(new Error("boom"));

    const { ctx, configsLoaded } = await loadOnboarding();

    // the api toasts its own failures; the wizard simply has nothing to show
    expect(configsLoaded.value).toBe(false);
    expect(ctx.value.providers).toEqual([]);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("lists a configuration that is set up but needs attention", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC, {
      enabled: false,
    });
    addProvider("subsonic--1", "subsonic", ProviderType.MUSIC, {
      lastError: { error_code: 1, message: "no such server" },
    });
    addProvider("filesystem--1", "filesystem", ProviderType.MUSIC);
    addProvider("builtin--1", "builtin_music", ProviderType.MUSIC, {
      builtin: true,
    });

    const module = await loadModule();
    const { ctx, pending, loadProviderConfigs } = module.useOnboarding();
    await loadProviderConfigs();

    // a switched off source is still a source: the step is done either way
    expect(module.configuredProviders(ProviderType.MUSIC)).toEqual([
      {
        instance_id: "spotify--1",
        name: "spotify manifest",
        domain: "spotify",
        needsAttention: true,
      },
      {
        instance_id: "subsonic--1",
        name: "subsonic manifest",
        domain: "subsonic",
        needsAttention: true,
      },
      {
        instance_id: "filesystem--1",
        name: "filesystem manifest",
        domain: "filesystem",
        needsAttention: false,
      },
    ]);
    expect(pending.value.map((step) => step.id)).not.toContain("music_sources");
    expect(ctx.value.providers).toHaveLength(4);
  });

  it("prefers the name the configuration carries", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    providerConfigs.list[0].name = "The kitchen's Spotify";

    const module = await loadModule();
    await module.useOnboarding().loadProviderConfigs();

    expect(module.configuredProviders(ProviderType.MUSIC)[0].name).toBe(
      "The kitchen's Spotify",
    );
  });

  it("persists the intent answer as a user preference", async () => {
    const { setIntent } = await loadOnboarding();

    await setIntent("phone_apps");

    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "phone_apps",
    );
  });

  it("hides the checklist for the session until a new step turns up", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { dismiss, dismissed, pending } = await loadOnboarding();
    preferenceState.intent.value = "music_hub";
    expect(pending.value.map((step) => step.id)).toEqual([
      "players",
      "plugins",
    ]);

    dismiss();
    expect(dismissed.value).toBe(true);

    // the same steps in another order are not new ones
    preferenceState.intent.value = "phone_apps";
    expect(dismissed.value).toBe(true);

    // the intent question coming back is a step the dismissal never covered
    preferenceState.intent.value = undefined;
    expect(dismissed.value).toBe(false);
  });

  it("counts only the steps that block finishing", async () => {
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const { pending, requiredPending, hasPending } = await loadOnboarding();
    preferenceState.intent.value = "phone_apps";

    // both steps left are optional for someone streaming from phone apps
    expect(pending.value.map((step) => step.id)).toEqual([
      "plugins",
      "music_sources",
    ]);
    expect(requiredPending.value).toEqual([]);
    expect(hasPending.value).toBe(false);
  });

  it("counts a step that does block finishing", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { requiredPending, hasPending } = await loadOnboarding();
    preferenceState.intent.value = "music_hub";

    expect(requiredPending.value.map((step) => step.id)).toEqual(["players"]);
    expect(hasPending.value).toBe(true);
  });

  it("asks the server to complete onboarding without a global error toast", async () => {
    const { finish } = await loadOnboarding();

    await expect(finish()).resolves.toBe(true);

    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      "config/onboard_complete",
      undefined,
      { suppressGlobalError: true },
    );
  });

  it.each(SERVERS_THAT_NEED_NO_COMMAND)(
    "skips the command on a server that %s",
    async (_case, serverInfo) => {
      apiMock.serverInfo.value = serverInfo;

      const { finish } = await loadOnboarding();
      await expect(finish()).resolves.toBe(true);

      expect(apiMock.sendCommand).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
    },
  );

  // 12 is InvalidCommand (the server dropped the command when it completed
  // onboarding itself), 3 an InvalidDataError ("Onboarding already completed")
  it.each([12, 3])("swallows error code %i without a word", async (code) => {
    const { finish } = await loadOnboarding();
    apiMock.sendCommand.mockRejectedValue(
      await apiCommandError(code, "Onboarding already completed"),
    );

    await expect(finish()).resolves.toBe(true);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
  });

  it("keeps the wizard open on another error code", async () => {
    const { dismissed, finish } = await loadOnboarding();
    apiMock.sendCommand.mockRejectedValue(await apiCommandError(5));

    await expect(finish()).resolves.toBe(false);

    expect(toastMock.error).toHaveBeenCalledOnce();
    expect(toastMock.error).toHaveBeenCalledWith("onboarding.finish_failed");
    // onboarding is still open on the server, so neither is it here
    expect(dismissed.value).toBe(false);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("keeps the wizard open on a failure that is not an api error", async () => {
    apiMock.sendCommand.mockRejectedValue(new Error("boom"));

    const { dismissed, finish } = await loadOnboarding();
    await expect(finish()).resolves.toBe(false);

    expect(toastMock.error).toHaveBeenCalledOnce();
    expect(dismissed.value).toBe(false);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it.each(["phone_apps", "music_hub"] as const)(
    "hands someone who came for %s back to the app",
    async (intent) => {
      const { finish } = await loadOnboarding();
      preferenceState.intent.value = intent;

      await finish();

      expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
    },
  );

  it("hides the checklist once the wizard is done with", async () => {
    const { dismissed, finish } = await loadOnboarding();
    expect(dismissed.value).toBe(false);

    await finish();

    expect(dismissed.value).toBe(true);
  });
});
