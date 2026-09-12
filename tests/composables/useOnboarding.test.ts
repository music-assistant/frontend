import { ProviderType } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  authMock,
  preferenceState,
  routerMock,
  setUserPreferenceMock,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, { builtin: boolean }>,
    providers: {} as Record<
      string,
      { instance_id: string; domain: string; type: ProviderType }
    >,
    sendCommand: vi.fn(),
    serverInfo: { value: undefined as { onboard_done: boolean } | undefined },
  },
  authMock: { isAdmin: vi.fn(() => true) },
  // replaced with a real ref by the userPreferences mock factory below, so
  // the composable's computed context follows what a test sets here
  preferenceState: { intent: { value: undefined } as { value?: string } },
  routerMock: { replace: vi.fn(), push: vi.fn() },
  setUserPreferenceMock: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

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

type Onboarding = ReturnType<
  typeof import("@/composables/useOnboarding").useOnboarding
>;

/** A fresh singleton per test: the dismissed flag lives for a whole session. */
async function loadOnboarding(): Promise<Onboarding> {
  vi.resetModules();
  const module = await import("@/composables/useOnboarding");
  return module.useOnboarding();
}

function addProvider(
  instanceId: string,
  domain: string,
  type: ProviderType,
  builtin = false,
) {
  apiMock.providers[instanceId] = { instance_id: instanceId, domain, type };
  apiMock.providerManifests[domain] = { builtin };
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
    apiMock.providers = {};
    apiMock.sendCommand.mockReset();
    apiMock.sendCommand.mockResolvedValue(undefined);
    apiMock.serverInfo.value = { onboard_done: false };
    authMock.isAdmin.mockReturnValue(true);
    routerMock.replace.mockReset();
    setUserPreferenceMock.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    preferenceState.intent.value = undefined;
  });

  it("reads the context from the configured providers", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    addProvider("builtin--1", "builtin_player", ProviderType.PLAYER, true);
    apiMock.players = { player_1: {}, player_2: {} };

    const { ctx, pending, hasPending } = await loadOnboarding();

    expect(ctx.value.playerCount).toBe(2);
    expect(ctx.value.providers).toEqual([
      { type: ProviderType.MUSIC, domain: "spotify", builtin: false },
      { type: ProviderType.PLAYER, domain: "builtin_player", builtin: true },
    ]);
    // the builtin player provider does not tick the players step off
    expect(pending.value.map((step) => step.id)).toEqual([
      "intent",
      "players",
      "plugins",
    ]);
    expect(hasPending.value).toBe(true);
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

    await finish();

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
      await finish();

      expect(apiMock.sendCommand).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
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

    await finish();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
  });

  it("warns about another error code but still leaves the wizard", async () => {
    const { finish } = await loadOnboarding();
    apiMock.sendCommand.mockRejectedValue(await apiCommandError(5));

    await finish();

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
  });

  it("warns about a failure that is not an api error", async () => {
    apiMock.sendCommand.mockRejectedValue(new Error("boom"));

    const { finish } = await loadOnboarding();
    await finish();

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
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
