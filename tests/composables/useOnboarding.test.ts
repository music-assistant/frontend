import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import {
  ProviderType,
  UserRole,
  type Scope,
  type User,
} from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILTIN_ROLE_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../fixtures/scopes";
import { user } from "../fixtures/user";

const {
  apiMock,
  authMock,
  preferenceState,
  providerConfigs,
  routerMock,
  setUserPreferenceMock,
  setUserPreferencesMock,
  storeState,
  toastMock,
  users,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    // the instances that loaded, which name a provider before its config does
    providers: {} as Record<string, { name: string }>,
    providerManifests: {} as Record<string, { builtin: boolean; name: string }>,
    getAllUsers: vi.fn(),
    getProviderConfigs: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: { value: undefined as { onboard_done: boolean } | undefined },
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  // replaced with real refs by the userPreferences mock factory below, so
  // the composable's computed context follows what a test sets here
  preferenceState: {
    intent: { value: undefined } as { value?: string },
    persona: { value: undefined } as { value?: string },
    welcomedAt: { value: undefined } as { value?: string },
  },
  // what the server hands back as the provider configurations
  providerConfigs: { list: [] as Record<string, unknown>[] },
  routerMock: { replace: vi.fn(), push: vi.fn() },
  setUserPreferenceMock: vi.fn(),
  setUserPreferencesMock: vi.fn(),
  // replaced with a reactive store by the store mock factory below: who is
  // signed in is what tells the two onboarding tracks apart
  storeState: {
    store: { currentUser: undefined } as { currentUser?: User },
    ready: false,
  },
  toastMock: { error: vi.fn() },
  // what the server hands back as the user accounts
  users: { list: [] as ReturnType<typeof user>[] },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  // every test loads a fresh composable, which runs this factory again: hand
  // out the same store, so the user a test signed in survives the reload
  if (!storeState.ready) {
    storeState.store = reactive({ currentUser: undefined as User | undefined });
    storeState.ready = true;
  }
  return { store: storeState.store };
});

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  preferenceState.intent = ref<string | undefined>(undefined);
  preferenceState.persona = ref<string | undefined>(undefined);
  preferenceState.welcomedAt = ref<string | undefined>(undefined);
  const preferences: Record<string, { value?: string }> = {
    "onboarding.intent": preferenceState.intent,
    "onboarding.persona": preferenceState.persona,
    "onboarding.welcome": preferenceState.welcomedAt,
  };
  return {
    setUserPreference: setUserPreferenceMock,
    setUserPreferences: setUserPreferencesMock,
    useUserPreferences: () => ({
      getPreference: (key: string) => preferences[key],
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

/** The composable with the provider configurations and the users already in. */
async function loadOnboarding(): Promise<Onboarding> {
  const onboarding = (await loadModule()).useOnboarding();
  await onboarding.loadOnboardingData();
  return onboarding;
}

/** Who the session is signed in as, which is half of what decides the track. */
function signIn(overrides: Partial<User> = {}): User {
  const account = user(overrides);
  storeState.store.currentUser = account;
  return account;
}

/** Sign in with a role and the scopes it grants, member scopes by default. */
function signInAs(
  overrides: Partial<User> = {},
  scopes: readonly Scope[] = BUILTIN_ROLE_SCOPES.user,
): User {
  authMock.hasScope.mockImplementation(scopeChecker(scopes));
  return signIn({ user_id: "sam-1", username: "sam", ...overrides });
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

// every test loads the composable anew after resetting the module registry,
// which can take seconds under load
describe("useOnboarding", { timeout: 20_000 }, () => {
  beforeEach(() => {
    apiMock.players = {};
    apiMock.providers = {};
    apiMock.providerManifests = {};
    providerConfigs.list = [];
    users.list = [user({ user_id: "admin-1", username: "admin" })];
    apiMock.getProviderConfigs.mockReset();
    apiMock.getProviderConfigs.mockImplementation(async () => [
      ...providerConfigs.list,
    ]);
    apiMock.getAllUsers.mockReset();
    apiMock.getAllUsers.mockImplementation(async () => [...users.list]);
    apiMock.subscribe.mockClear();
    apiMock.sendCommand.mockReset();
    apiMock.sendCommand.mockResolvedValue(undefined);
    apiMock.serverInfo.value = { onboard_done: false };
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    signIn({ user_id: "admin-1", username: "admin", role: UserRole.ADMIN });
    routerMock.replace.mockReset();
    // both answer as the real ones do: a promise, and whether it landed
    setUserPreferenceMock.mockReset();
    setUserPreferenceMock.mockResolvedValue(undefined);
    setUserPreferencesMock.mockReset();
    setUserPreferencesMock.mockResolvedValue(true);
    toastMock.error.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    preferenceState.intent.value = undefined;
    preferenceState.persona.value = undefined;
    preferenceState.welcomedAt.value = undefined;
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
      "invite_members",
    ]);
    expect(hasPending.value).toBe(true);
  });

  it("asks nothing of a guest, who is only passing through", async () => {
    signInAs(
      { user_id: "guest-1", username: "guest", role: UserRole.GUEST },
      BUILTIN_ROLE_SCOPES.guest,
    );
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { steps, hasPending } = await loadOnboarding();

    expect(steps.value).toEqual([]);
    expect(hasPending.value).toBe(false);
  });

  it("asks a member nothing about the setup they are not running", async () => {
    signInAs();
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { steps, ctx } = await loadOnboarding();

    // the welcome instead of the setup: none of the admin track is theirs
    expect(steps.value.map((step) => step.id)).toEqual([
      "welcome",
      "whats_here",
      "tour",
      "all_set",
    ]);
    expect(ctx.value.isAdmin).toBe(false);
    expect(ctx.value.isMember).toBe(true);
  });

  it("decides nothing before the onboarding data is in", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { ctx, dataLoaded, loadOnboardingData } = (
      await loadModule()
    ).useOnboarding();

    expect(dataLoaded.value).toBe(false);
    expect(ctx.value.providers).toEqual([]);
    expect(ctx.value.memberCount).toBeNull();
    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
    expect(apiMock.getAllUsers).not.toHaveBeenCalled();

    await loadOnboardingData();

    expect(dataLoaded.value).toBe(true);
    expect(ctx.value.providers).toHaveLength(1);
    expect(ctx.value.memberCount).toBe(1);
  });

  it("leaves the users alone for a checklist that never lists them", async () => {
    const { configsLoaded, dataLoaded, loadProviderConfigs } = (
      await loadModule()
    ).useOnboarding();

    await loadProviderConfigs();

    // the sidebar checklist decides off the provider configurations alone, so
    // an admin session pays for those and nothing else
    expect(apiMock.getProviderConfigs).toHaveBeenCalledOnce();
    expect(apiMock.getAllUsers).not.toHaveBeenCalled();
    expect(configsLoaded.value).toBe(true);
    // and the wizard, which does ask about the household, is still waiting
    expect(dataLoaded.value).toBe(false);
  });

  it("asks for everything it needs once while a load is in flight", async () => {
    let handOverConfigs: (configs: unknown[]) => void = () => {};
    apiMock.getProviderConfigs.mockImplementation(
      () =>
        new Promise((resolve) => {
          handOverConfigs = resolve;
        }),
    );

    const { dataLoaded, loadOnboardingData } = (
      await loadModule()
    ).useOnboarding();
    const both = Promise.all([loadOnboardingData(), loadOnboardingData()]);

    expect(apiMock.getProviderConfigs).toHaveBeenCalledOnce();
    expect(apiMock.getAllUsers).toHaveBeenCalledOnce();

    handOverConfigs([]);
    await both;

    expect(dataLoaded.value).toBe(true);
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

    const { ctx, dataLoaded } = await loadOnboarding();

    // the api toasts its own failures; the wizard simply has nothing to show
    expect(dataLoaded.value).toBe(false);
    expect(ctx.value.providers).toEqual([]);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("counts the household members, and nobody else", async () => {
    users.list = [
      user({ user_id: "admin-1", username: "admin", display_name: "Marcel" }),
      user({ user_id: "partner-1", username: "sam", display_name: "Sam" }),
      user({
        user_id: "ha-1",
        username: HOMEASSISTANT_SYSTEM_USER,
        role: UserRole.SERVICE,
      }),
      user({ user_id: "guest-1", username: "guest", role: UserRole.GUEST }),
      user({ user_id: "service-1", username: "bot", role: UserRole.SERVICE }),
      user({ user_id: "old-1", username: "moved-out", enabled: false }),
    ];

    const module = await loadModule();
    const { ctx, pending } = module.useOnboarding();
    await module.useOnboarding().loadOnboardingData();

    // the Home Assistant account, the guests, the service accounts and an
    // account nobody can sign in with are not people who live here
    expect(ctx.value.memberCount).toBe(2);
    expect(module.householdMembers()).toEqual([
      { user_id: "admin-1", name: "Marcel", role: "user" },
      { user_id: "partner-1", name: "Sam", role: "user" },
    ]);
    expect(pending.value.map((step) => step.id)).not.toContain(
      "invite_members",
    );
  });

  it("never asks the server for the users on behalf of someone who may not list them", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );

    const { ctx, dataLoaded } = await loadOnboarding();

    expect(apiMock.getAllUsers).not.toHaveBeenCalled();
    // nothing to wait for, and nothing claimed about a household nobody asked
    // about
    expect(dataLoaded.value).toBe(true);
    expect(ctx.value.memberCount).toBeNull();
  });

  it("takes the household as unknown when the users cannot be loaded", async () => {
    apiMock.getAllUsers.mockRejectedValue(new Error("boom"));

    const module = await loadModule();
    const { ctx, dataLoaded, steps } = module.useOnboarding();
    await module.useOnboarding().loadOnboardingData();

    // the api toasts its own failures; the step is then simply not done and,
    // being optional, holds nothing up
    expect(dataLoaded.value).toBe(true);
    expect(ctx.value.memberCount).toBeNull();
    expect(module.householdMembers()).toEqual([]);
    const invite = steps.value.find((step) => step.id === "invite_members")!;
    expect(invite.isDone(ctx.value)).toBe(false);
    expect(invite.optional).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("takes the household the server lists again once a member was added", async () => {
    const module = await loadModule();
    const { ctx, loadUsers } = module.useOnboarding();
    await module.useOnboarding().loadOnboardingData();
    expect(ctx.value.memberCount).toBe(1);

    users.list.push(user({ user_id: "partner-1", username: "sam" }));
    await loadUsers();

    expect(apiMock.getAllUsers).toHaveBeenCalledTimes(2);
    expect(ctx.value.memberCount).toBe(2);
  });

  it("takes the household as unknown again when a refresh does not land", async () => {
    const module = await loadModule();
    const { ctx, loadUsers } = module.useOnboarding();
    await module.useOnboarding().loadOnboardingData();
    expect(ctx.value.memberCount).toBe(1);

    apiMock.getAllUsers.mockRejectedValue(new Error("boom"));
    await loadUsers();

    // a household that could not be listed again is unknown, not the one the
    // server last happened to say
    expect(ctx.value.memberCount).toBeNull();
    expect(module.householdMembers()).toEqual([]);
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
    const { ctx, pending, loadOnboardingData } = module.useOnboarding();
    await loadOnboardingData();

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

  it("prefers the name the loaded instance goes by", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    providerConfigs.list[0].name = "The kitchen's Spotify";
    apiMock.providers["spotify--1"] = { name: "Spotify in the kitchen" };

    const module = await loadModule();
    await module.useOnboarding().loadOnboardingData();

    expect(module.configuredProviders(ProviderType.MUSIC)[0].name).toBe(
      "Spotify in the kitchen",
    );
  });

  it("falls back on the name the configuration carries", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    providerConfigs.list[0].name = "The kitchen's Spotify";

    const module = await loadModule();
    await module.useOnboarding().loadOnboardingData();

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
      "invite_members",
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

  it("keeps asking for a music source that was only deferred", async () => {
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const { pending, checklist, checklistPending, hasPending } =
      await loadOnboarding();
    preferenceState.intent.value = "phone_apps";

    // the plugins are optional and never asked for; the deferred music sources
    // stay on the checklist, which is the point of deferring them
    expect(pending.value.map((step) => step.id)).toEqual([
      "plugins",
      "music_sources",
      "invite_members",
    ]);
    expect(checklist.value.map((step) => step.id)).toEqual([
      "intent",
      "players",
      "music_sources",
    ]);
    expect(checklistPending.value.map((step) => step.id)).toEqual([
      "music_sources",
    ]);
    expect(hasPending.value).toBe(true);
  });

  it("counts the steps of its list that are still to do", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { checklist, checklistPending, hasPending } = await loadOnboarding();
    preferenceState.intent.value = "music_hub";

    // the music sources are done, so they are listed but not counted
    expect(checklist.value.map((step) => step.id)).toEqual([
      "intent",
      "music_sources",
      "players",
    ]);
    expect(checklistPending.value.map((step) => step.id)).toEqual(["players"]);
    expect(hasPending.value).toBe(true);
  });

  it("stops asking once everything it lists is done", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const { pending, checklistPending, hasPending } = await loadOnboarding();
    preferenceState.intent.value = "music_hub";

    // the plugins and the household are still to do, and still nothing to ask
    // about
    expect(pending.value.map((step) => step.id)).toEqual([
      "plugins",
      "invite_members",
    ]);
    expect(checklistPending.value).toEqual([]);
    expect(hasPending.value).toBe(false);
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

  describe("the track a session is on", () => {
    const ADMIN_STEPS = [
      "intent",
      "music_sources",
      "players",
      "plugins",
      "core_settings",
      "invite_members",
      "finish",
    ];
    const MEMBER_STEPS = ["welcome", "whats_here", "tour", "all_set"];

    it.each([
      ["an admin", BUILTIN_ROLE_SCOPES.admin, UserRole.ADMIN, ADMIN_STEPS],
      ["a member", BUILTIN_ROLE_SCOPES.user, UserRole.USER, MEMBER_STEPS],
      // a role an admin made up here: not a guest, so someone who lives here
      ["a custom role", OWN_SOURCES_ROLE_SCOPES, "dj", MEMBER_STEPS],
      ["a guest", BUILTIN_ROLE_SCOPES.guest, UserRole.GUEST, []],
      // the Home Assistant integration signs in as one of these
      ["a service account", BUILTIN_ROLE_SCOPES.user, UserRole.SERVICE, []],
    ])("runs %s through its own steps", async (_case, scopes, role, steps) => {
      signInAs({ role }, scopes);

      const onboarding = (await loadModule()).useOnboarding();
      await onboarding.loadOnboardingData();

      expect(onboarding.steps.value.map((step) => step.id)).toEqual(steps);
    });

    it("has nothing for a session nobody is signed in on", async () => {
      authMock.hasScope.mockImplementation(
        scopeChecker(BUILTIN_ROLE_SCOPES.user),
      );
      storeState.store.currentUser = undefined;

      const { steps } = (await loadModule()).useOnboarding();

      expect(steps.value).toEqual([]);
    });

    it("never asks the server for configurations a role may not list", async () => {
      // a custom role that holds none of the configuration scopes: the member
      // track reads none of this anyway, and a request that could only fail
      // would greet them with an error toast
      signInAs({ role: "dj" }, BUILTIN_ROLE_SCOPES.guest);

      const { configsLoaded, ctx } = await loadOnboarding();

      expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
      expect(configsLoaded.value).toBe(true);
      expect(ctx.value.providers).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
    });
  });

  describe("the welcome", () => {
    it("writes the persona and the settings it stands for in one go", async () => {
      signInAs();

      const { setPersona } = await loadOnboarding();
      await expect(setPersona("enthusiast")).resolves.toBe(true);

      // one update: the account never holds the answer without the settings
      // that answer was given for, and one message if it fails: the step has
      // something of its own to say, so the api stays quiet
      expect(setUserPreferencesMock).toHaveBeenCalledOnce();
      expect(setUserPreferencesMock).toHaveBeenCalledWith(
        {
          "onboarding.persona": "enthusiast",
          show_waveform: true,
          visualizer_enabled: true,
        },
        { suppressGlobalError: true },
      );
    });

    it("seeds the settings again when the member answers again", async () => {
      signInAs();
      preferenceState.persona.value = "enthusiast";

      const { setPersona } = await loadOnboarding();
      await setPersona("regular");

      expect(setUserPreferencesMock).toHaveBeenCalledWith(
        {
          "onboarding.persona": "regular",
          show_waveform: false,
          visualizer_enabled: false,
        },
        { suppressGlobalError: true },
      );
    });

    it("marks the member as welcomed on the way out", async () => {
      signInAs();

      const { finish } = await loadOnboarding();
      await expect(finish()).resolves.toBe(true);

      // nothing is closed off on the server: the setup is the admin's, and
      // the member's own account is all the welcome leaves a mark on
      expect(apiMock.sendCommand).not.toHaveBeenCalled();
      expect(setUserPreferencesMock).toHaveBeenCalledOnce();
      const [values] = setUserPreferencesMock.mock.calls[0];
      const marker = (values as Record<string, string>)["onboarding.welcome"];
      expect(Date.parse(marker)).not.toBeNaN();
      expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
    });

    it("keeps the member here when the mark could not be made", async () => {
      signInAs();
      setUserPreferencesMock.mockResolvedValue(false);

      const { dismissed, finish } = await loadOnboarding();
      await expect(finish()).resolves.toBe(false);

      // handing them back to the app now would only welcome them again on the
      // next reload, so the wizard stays put and says so — once: the api keeps
      // its own message to itself here
      expect(setUserPreferencesMock).toHaveBeenCalledWith(expect.anything(), {
        suppressGlobalError: true,
      });
      expect(toastMock.error).toHaveBeenCalledOnce();
      expect(toastMock.error).toHaveBeenCalledWith("onboarding.finish_failed");
      expect(dismissed.value).toBe(false);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("marks the account that asked, not the one before it", async () => {
      signInAs({ user_id: "sam-1" });
      let landFirst: () => void = () => {};
      setUserPreferencesMock.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            landFirst = () => resolve(true);
          }),
      );

      const { markWelcomed } = await loadOnboarding();
      const first = markWelcomed();
      // somebody else is signed in before the first marker has landed
      signInAs({ user_id: "alex-1", username: "alex" });
      const second = markWelcomed();
      landFirst();

      await expect(Promise.all([first, second])).resolves.toEqual([true, true]);

      // joining the write on its way out would tell the new account its
      // welcome had been marked when nothing of theirs was ever written
      expect(setUserPreferencesMock).toHaveBeenCalledTimes(2);
    });

    it("leaves the api to say so when the mark is made on the way out", async () => {
      signInAs();

      const { markWelcomed } = await loadOnboarding();
      await expect(markWelcomed()).resolves.toBe(true);

      // nobody is being held up here: the page is already going, so a failure
      // is the api's to report as it would any other
      expect(setUserPreferencesMock).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
      );
    });

    it("leaves the mark of the first welcome where it is", async () => {
      signInAs();
      preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";

      const { finish } = await loadOnboarding();
      await expect(finish()).resolves.toBe(true);

      // when they were welcomed, not when they last looked it over again
      expect(setUserPreferencesMock).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
    });

    it("hands a failed answer back to whoever asked the question", async () => {
      signInAs();
      setUserPreferencesMock.mockResolvedValue(false);

      const { setPersona } = await loadOnboarding();

      // the step has something to tell the user; this only says what happened
      await expect(setPersona("regular")).resolves.toBe(false);
    });

    it("marks the welcome once, however often it is asked to", async () => {
      signInAs();
      let landWrite: () => void = () => {};
      setUserPreferencesMock.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            landWrite = () => resolve(true);
          }),
      );

      const { markWelcomed } = await loadOnboarding();
      // the wizard finishing and the page it leaves behind, in that order and
      // with neither waiting for the other
      const both = Promise.all([markWelcomed(), markWelcomed()]);
      landWrite();
      await expect(both).resolves.toEqual([true, true]);

      // one mark, one write: the account is told once that it has been made
      expect(setUserPreferencesMock).toHaveBeenCalledOnce();
    });

    it("counts a member who was welcomed before as answered enough", async () => {
      signInAs();
      preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";

      const { ctx, checklistPending, hasPending } = await loadOnboarding();

      // the checklist stops asking: they have seen it, whatever they made of it
      expect(ctx.value.welcomed).toBe(true);
      expect(checklistPending.value).toEqual([]);
      expect(hasPending.value).toBe(false);
    });

    it("keeps asking the member who is being welcomed right now", async () => {
      signInAs();

      const { ctx, pending, checklistPending } = await loadOnboarding();

      // the marker is written on the way out, so the question is open for the
      // whole of this run — and the summary says so
      expect(ctx.value.welcomed).toBe(false);
      expect(pending.value.map((step) => step.id)).toEqual(["welcome"]);
      expect(checklistPending.value.map((step) => step.id)).toEqual([
        "welcome",
      ]);
    });
  });
});
