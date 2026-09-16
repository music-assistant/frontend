import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import {
  EventType,
  PlayerType,
  ProviderSharing,
  ProviderType,
  Scope,
  UserRole,
  type EventMessage,
  type Player,
  type PlayerConfig,
  type User,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { outputProtocol } from "../fixtures/outputProtocol";
import { playerConfig } from "../fixtures/playerConfig";
import { providerConfig } from "../fixtures/providerConfig";
import {
  BUILTIN_ROLE_SCOPES,
  MEMBER_WITHOUT_OWN_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../fixtures/scopes";
import { user } from "../fixtures/user";

const {
  apiMock,
  authMock,
  playerConfigs,
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
    // the players that registered, which is where a player's live state is
    players: {} as Record<string, Partial<Player>>,
    // the instances that loaded, which name a provider that has no custom name
    providers: {} as Record<string, { name: string; domain?: string }>,
    providerManifests: {} as Record<string, { builtin: boolean; name: string }>,
    getAllUsers: vi.fn(),
    getPlayerConfig: vi.fn(),
    getPlayerConfigs: vi.fn(),
    getProviderConfigs: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    subscribe_multi:
      vi.fn<
        (
          events: EventType[],
          handler: (evt: EventMessage) => void,
        ) => () => void
      >(),
    sendCommand: vi.fn(),
    serverInfo: { value: undefined as { onboard_done: boolean } | undefined },
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  // what the server hands back as the player configurations
  playerConfigs: { list: [] as PlayerConfig[] },
  // replaced with real refs by the userPreferences mock factory below, so
  // the composable's computed context follows what a test sets here
  preferenceState: {
    intent: { value: undefined } as { value?: string },
    expertMode: { value: undefined } as { value?: boolean },
    // the welcome's answer as an account holds it that answered before the
    // expert mode flag existed
    legacyPersona: { value: undefined } as { value?: string },
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
  preferenceState.expertMode = ref<boolean | undefined>(undefined);
  preferenceState.legacyPersona = ref<string | undefined>(undefined);
  preferenceState.welcomedAt = ref<string | undefined>(undefined);
  const preferences: Record<string, { value?: string | boolean }> = {
    "onboarding.intent": preferenceState.intent,
    expert_mode: preferenceState.expertMode,
    "onboarding.persona": preferenceState.legacyPersona,
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

/** A fresh singleton per test: the modal open state lives for a whole session. */
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

/** The same, as the module, for the listings it exports directly. */
async function loadOnboardingModule(): Promise<OnboardingModule> {
  const module = await loadModule();
  await module.useOnboarding().loadOnboardingData();
  return module;
}

/** Who the session is signed in as, which is half of what decides the track. */
function signIn(overrides: Partial<User> = {}): User {
  const account = user(overrides);
  storeState.store.currentUser = account;
  return account;
}

/**
 * Sign in with a role and the scopes it grants. Defaults to a member who may
 * not add sources of their own, so the welcome runs on its own; pass scopes for
 * a role that can.
 */
function signInAs(
  overrides: Partial<User> = {},
  scopes: readonly Scope[] = MEMBER_WITHOUT_OWN_SCOPES,
): User {
  authMock.hasScope.mockImplementation(scopeChecker(scopes));
  return signIn({ user_id: "sam-1", username: "sam", ...overrides });
}

function addProvider(
  instanceId: string,
  domain: string,
  type: ProviderType,
  options: {
    builtin?: boolean;
    enabled?: boolean;
    lastError?: unknown;
    name?: string;
  } = {},
) {
  providerConfigs.list.push({
    instance_id: instanceId,
    domain,
    type,
    name: options.name ?? null,
    enabled: options.enabled ?? true,
    last_error: options.lastError ?? null,
  });
  apiMock.providerManifests[domain] = {
    builtin: options.builtin ?? false,
    name: `${domain} manifest`,
  };
}

/** A music source that carries an owner, as a member's own source does. */
function addOwnedSource(instanceId: string, domain: string, owner: string) {
  providerConfigs.list.push({
    ...providerConfig({
      instance_id: instanceId,
      domain,
      type: ProviderType.MUSIC,
      access: { owner, sharing: ProviderSharing.PRIVATE, shared_users: [] },
    }),
  });
  apiMock.providerManifests[domain] = {
    builtin: false,
    name: `${domain} manifest`,
  };
}

/** A player the server holds a configuration for, registered or not. */
function addPlayerConfig(overrides: Partial<PlayerConfig> = {}): PlayerConfig {
  const config = playerConfig(overrides);
  playerConfigs.list.push(config);
  return config;
}

/** A player that registered, which is where its live state comes from. */
function registerPlayer(playerId: string, overrides: Partial<Player> = {}) {
  apiMock.players[playerId] = {
    player_id: playerId,
    available: true,
    ...overrides,
  };
}

/** What every player is labelled with, by player, whatever the order. */
function playerLabels(module: OnboardingModule): Record<string, string> {
  return Object.fromEntries(
    module
      .discoveredPlayers()
      .map((player) => [player.player_id, player.providerLabel]),
  );
}

/** The handler the wizard follows the players with. */
function playerEventHandler(): (evt: EventMessage) => void {
  const call = apiMock.subscribe_multi.mock.calls.at(-1);
  if (!call) throw new Error("The players are not being followed");
  return call[1];
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

// A custom role that may control the players without reading what they are
// configured with, which every builtin role happens to be allowed.
const NO_PLAYER_CONFIG_SCOPES: readonly Scope[] =
  BUILTIN_ROLE_SCOPES.guest.filter(
    (scope) => scope !== Scope.CONFIG_PLAYERS_READ,
  );

let warnSpy: ReturnType<typeof vi.spyOn>;

// every test loads the composable anew after resetting the module registry,
// which can take seconds under load
describe("useOnboarding", { timeout: 20_000 }, () => {
  beforeEach(() => {
    apiMock.players = {};
    apiMock.providers = {};
    apiMock.providerManifests = {};
    playerConfigs.list = [];
    providerConfigs.list = [];
    users.list = [user({ user_id: "admin-1", username: "admin" })];
    apiMock.getProviderConfigs.mockReset();
    apiMock.getProviderConfigs.mockImplementation(async () => [
      ...providerConfigs.list,
    ]);
    apiMock.getPlayerConfigs.mockReset();
    apiMock.getPlayerConfigs.mockImplementation(async () => [
      ...playerConfigs.list,
    ]);
    apiMock.getPlayerConfig.mockReset();
    apiMock.getAllUsers.mockReset();
    apiMock.getAllUsers.mockImplementation(async () => [...users.list]);
    apiMock.subscribe.mockClear();
    apiMock.subscribe_multi.mockReset();
    apiMock.subscribe_multi.mockImplementation(() => vi.fn());
    apiMock.sendCommand.mockReset();
    apiMock.sendCommand.mockResolvedValue(undefined);
    apiMock.serverInfo.value = { onboard_done: false };
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    signIn({ user_id: "admin-1", username: "admin", role: UserRole.ADMIN });
    // both answer as the real ones do: a promise, and whether it landed
    setUserPreferenceMock.mockReset();
    setUserPreferenceMock.mockResolvedValue(true);
    setUserPreferencesMock.mockReset();
    setUserPreferencesMock.mockResolvedValue(true);
    toastMock.error.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    preferenceState.intent.value = undefined;
    preferenceState.expertMode.value = undefined;
    preferenceState.legacyPersona.value = undefined;
    preferenceState.welcomedAt.value = undefined;
  });

  it("reads the context from the provider configurations", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    addProvider("builtin--1", "builtin_player", ProviderType.PLAYER, {
      builtin: true,
    });
    addPlayerConfig({ player_id: "kitchen" });
    addPlayerConfig({ player_id: "office" });

    const { ctx, pending } = await loadOnboarding();

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
  });

  it("asks nothing of a guest, who is only passing through", async () => {
    signInAs(
      { user_id: "guest-1", username: "guest", role: UserRole.GUEST },
      BUILTIN_ROLE_SCOPES.guest,
    );
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { steps } = await loadOnboarding();

    expect(steps.value).toEqual([]);
  });

  it("asks a member nothing about the setup they are not running", async () => {
    signInAs();
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { steps, ctx } = await loadOnboarding();

    // the welcome instead of the setup: none of the admin track is theirs
    expect(steps.value.map((step) => step.id)).toEqual([
      "welcome",
      "your_players",
      "your_music",
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

  it("loads the provider configurations without the users", async () => {
    const { configsLoaded, dataLoaded, loadProviderConfigs } = (
      await loadModule()
    ).useOnboarding();

    await loadProviderConfigs();

    // the member welcome decides off the provider configurations alone, so a
    // session that only needs those pays for those and nothing else
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
    expect(apiMock.getPlayerConfigs).toHaveBeenCalledOnce();
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

  it("loads the players along with the rest of the onboarding data", async () => {
    addPlayerConfig({ player_id: "kitchen", enabled: false });

    const module = await loadOnboardingModule();

    // the switched-off players too: those are unregistered, and the wizard is
    // where they are switched back on
    expect(apiMock.getPlayerConfigs).toHaveBeenCalledWith(
      undefined,
      false,
      false,
      true,
    );
    expect(module.discoveredPlayers()).toHaveLength(1);
  });

  it("never asks the server for the players a role may not list", async () => {
    signInAs({ role: "dj" }, NO_PLAYER_CONFIG_SCOPES);
    addPlayerConfig();

    const module = await loadOnboardingModule();

    // a request that could only fail at them would greet them with an error
    // toast; the empty list they can see is the answer
    expect(apiMock.getPlayerConfigs).not.toHaveBeenCalled();
    expect(module.discoveredPlayers()).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("lists no players when they cannot be loaded", async () => {
    addPlayerConfig();
    apiMock.getPlayerConfigs.mockRejectedValue(new Error("boom"));

    const module = await loadOnboardingModule();

    // the api toasts its own failures; the step simply has nothing to show
    expect(module.discoveredPlayers()).toEqual([]);
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

  it("prefers the custom name set on the configuration", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    providerConfigs.list[0].name = "The kitchen's Spotify";
    apiMock.providers["spotify--1"] = { name: "Spotify in the kitchen" };

    const module = await loadModule();
    await module.useOnboarding().loadOnboardingData();

    expect(module.configuredProviders(ProviderType.MUSIC)[0].name).toBe(
      "The kitchen's Spotify",
    );
  });

  it("falls back on the name the loaded instance goes by", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    apiMock.providers["spotify--1"] = { name: "Spotify in the kitchen" };

    const module = await loadModule();
    await module.useOnboarding().loadOnboardingData();

    expect(module.configuredProviders(ProviderType.MUSIC)[0].name).toBe(
      "Spotify in the kitchen",
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

  it("keeps a deferred music source in what is pending", async () => {
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const { pending } = await loadOnboarding();
    preferenceState.intent.value = "phone_apps";

    // the music sources moved behind the plugins for this answer, but stay in
    // what is pending rather than dropped
    expect(pending.value.map((step) => step.id)).toEqual([
      "plugins",
      "music_sources",
      "invite_members",
    ]);
  });

  it("leaves only the optional steps pending once the core is set up", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const { pending } = await loadOnboarding();
    preferenceState.intent.value = "music_hub";

    // the plugins and the household are optional, but still pending until done
    expect(pending.value.map((step) => step.id)).toEqual([
      "plugins",
      "invite_members",
    ]);
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

      const { active, open, finish } = await loadOnboarding();
      open();
      await expect(finish()).resolves.toBe(true);

      expect(apiMock.sendCommand).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(toastMock.error).not.toHaveBeenCalled();
      // finishing closes the modal rather than sending the user anywhere
      expect(active.value).toBe(false);
    },
  );

  // 12 is InvalidCommand (the server dropped the command when it completed
  // onboarding itself), 3 an InvalidDataError ("Onboarding already completed")
  it.each([12, 3])("swallows error code %i without a word", async (code) => {
    const { active, open, finish } = await loadOnboarding();
    open();
    apiMock.sendCommand.mockRejectedValue(
      await apiCommandError(code, "Onboarding already completed"),
    );

    await expect(finish()).resolves.toBe(true);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(active.value).toBe(false);
  });

  it("keeps the wizard open on another error code", async () => {
    const { active, open, finish } = await loadOnboarding();
    open();
    apiMock.sendCommand.mockRejectedValue(await apiCommandError(5));

    await expect(finish()).resolves.toBe(false);

    expect(toastMock.error).toHaveBeenCalledOnce();
    expect(toastMock.error).toHaveBeenCalledWith("onboarding.finish_failed");
    // onboarding is still open on the server, so the modal stays open too
    expect(active.value).toBe(true);
  });

  it("keeps the wizard open on a failure that is not an api error", async () => {
    apiMock.sendCommand.mockRejectedValue(new Error("boom"));

    const { active, open, finish } = await loadOnboarding();
    open();
    await expect(finish()).resolves.toBe(false);

    expect(toastMock.error).toHaveBeenCalledOnce();
    expect(active.value).toBe(true);
  });

  it.each(["phone_apps", "music_hub"] as const)(
    "closes the modal for someone who came for %s",
    async (intent) => {
      const { active, open, finish } = await loadOnboarding();
      preferenceState.intent.value = intent;
      open();

      await finish();

      expect(active.value).toBe(false);
    },
  );

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
    const MEMBER_STEPS = [
      "welcome",
      "your_players",
      "your_music",
      "own_sources",
      "tour",
      "all_set",
    ];
    // a member whose role may not add its own sources skips the own-sources step
    const MEMBER_STEPS_WITHOUT_OWN = [
      "welcome",
      "your_players",
      "your_music",
      "tour",
      "all_set",
    ];

    it.each([
      ["an admin", BUILTIN_ROLE_SCOPES.admin, UserRole.ADMIN, ADMIN_STEPS],
      ["a member", BUILTIN_ROLE_SCOPES.user, UserRole.USER, MEMBER_STEPS],
      // a role an admin made up here: not a guest, so someone who lives here
      ["a custom role", OWN_SOURCES_ROLE_SCOPES, "dj", MEMBER_STEPS],
      // a member whose role may not add its own sources
      [
        "a member who may not add sources",
        MEMBER_WITHOUT_OWN_SCOPES,
        UserRole.USER,
        MEMBER_STEPS_WITHOUT_OWN,
      ],
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

  describe("the players the wizard found", () => {
    beforeEach(() => {
      apiMock.providers["chromecast--1"] = {
        name: "Chromecast in the kitchen",
        domain: "chromecast",
      };
      apiMock.providerManifests["chromecast"] = {
        builtin: false,
        name: "Chromecast manifest",
      };
    });

    it("lists the players by name, switched-off ones included", async () => {
      addPlayerConfig({
        player_id: "kitchen",
        default_name: "Kitchen speaker",
      });
      addPlayerConfig({
        player_id: "office",
        name: "Attic",
        default_name: "Office speaker",
        enabled: false,
      });
      registerPlayer("kitchen", { needs_setup: true, icon: "speaker" });

      const module = await loadOnboardingModule();

      // by the name they go by, so a renamed player sits where the user reads
      // it; a switched-off one is unregistered and so has no live state at all
      expect(module.discoveredPlayers()).toEqual([
        {
          player_id: "office",
          name: "Attic",
          customName: "Attic",
          providerLabel: "Chromecast in the kitchen",
          enabled: false,
          available: false,
          needsSetup: false,
          icon: null,
          canToggle: true,
        },
        {
          player_id: "kitchen",
          name: "Kitchen speaker",
          customName: null,
          providerLabel: "Chromecast in the kitchen",
          enabled: true,
          available: true,
          needsSetup: true,
          icon: "speaker",
          canToggle: true,
        },
      ]);
    });

    it("leaves out a player that is one output of another", async () => {
      addPlayerConfig({ player_id: "kitchen" });
      addPlayerConfig({
        player_id: "kitchen-airplay",
        player_type: PlayerType.PROTOCOL,
      });

      const module = await loadOnboardingModule();

      // a protocol player is set up as part of the player it plays for
      expect(
        module.discoveredPlayers().map((player) => player.player_id),
      ).toEqual(["kitchen"]);
    });

    it("leaves out a web player of a tab that is gone", async () => {
      addPlayerConfig({
        player_id: "tab-1",
        provider: "sendspin",
        default_name: "Music Assistant Web (Firefox)",
      });
      addPlayerConfig({
        player_id: "tab-2",
        provider: "sendspin",
        default_name: "Music Assistant (Chrome)",
      });
      registerPlayer("tab-2");

      const module = await loadOnboardingModule();

      // the web players this app spawns come and go with every browser tab, so
      // one that is not around is nothing anyone set up
      expect(
        module.discoveredPlayers().map((player) => player.player_id),
      ).toEqual(["tab-2"]);
    });

    it("cannot switch a player whose provider is not running", async () => {
      addPlayerConfig({ player_id: "living", provider: "sonos--1" });

      const module = await loadOnboardingModule();

      expect(module.discoveredPlayers()[0].canToggle).toBe(false);
    });

    it("labels a player with the provider it came from", async () => {
      addPlayerConfig({ player_id: "living", provider: "sonos--1" });
      addPlayerConfig({ player_id: "study", provider: "airplay--1" });
      apiMock.providers["sonos--1"] = { name: "Sonos", domain: "sonos" };
      apiMock.providerManifests["sonos"] = {
        builtin: false,
        name: "Sonos manifest",
      };
      apiMock.providerManifests["airplay"] = {
        builtin: false,
        name: "AirPlay",
      };

      const module = await loadOnboardingModule();

      // the instance's own name, and the manifest for a provider whose
      // instance is not running to name itself
      expect(playerLabels(module)).toEqual({
        living: "Sonos",
        study: "AirPlay",
      });
    });

    it("labels a player with the name its provider was given, running or not", async () => {
      addProvider("sonos--1", "sonos", ProviderType.PLAYER, {
        name: "Downstairs Sonos",
      });
      addPlayerConfig({ player_id: "living", provider: "sonos--1" });
      apiMock.providerManifests["sonos"] = {
        builtin: false,
        name: "Sonos manifest",
      };

      const module = await loadOnboardingModule();

      // the same name the provider badge shows, which only the configuration
      // knows while the provider is switched off or failed to load
      expect(playerLabels(module)).toEqual({ living: "Downstairs Sonos" });
    });

    it("labels a player of the server's own machinery with what it plays through", async () => {
      addPlayerConfig({
        player_id: "everywhere",
        provider: "universal_player",
      });
      apiMock.providerManifests["universal_player"] = {
        builtin: true,
        name: "Universal player",
      };
      apiMock.providerManifests["airplay"] = {
        builtin: false,
        name: "AirPlay",
      };
      registerPlayer("everywhere", {
        output_protocols: [
          outputProtocol({
            output_protocol_id: "native",
            name: "Native",
            is_native: true,
            protocol_domain: "universal_player",
          }),
          outputProtocol({ name: "AirPlay (Kitchen)" }),
          outputProtocol({
            output_protocol_id: "airplay-office",
            name: "AirPlay (Office)",
          }),
          // a protocol whose provider has no manifest here names itself
          outputProtocol({
            output_protocol_id: "dlna-tv",
            name: "DLNA",
            protocol_domain: "dlna",
          }),
        ],
      });

      // what it plays through rather than the machinery behind it, each
      // protocol once however many outputs it has, and its own output left out
      expect(playerLabels(await loadOnboardingModule())).toEqual({
        everywhere: "AirPlay, DLNA",
      });
    });

    it("keeps what a player was last labelled with once it is switched off", async () => {
      addPlayerConfig({
        player_id: "everywhere",
        provider: "universal_player",
      });
      apiMock.providerManifests["universal_player"] = {
        builtin: true,
        name: "Universal player",
      };
      apiMock.providerManifests["airplay"] = {
        builtin: false,
        name: "AirPlay",
      };
      registerPlayer("everywhere", {
        output_protocols: [outputProtocol({ name: "AirPlay (Kitchen)" })],
      });

      const module = await loadOnboardingModule();
      expect(playerLabels(module)).toEqual({ everywhere: "AirPlay" });

      // switching it off unregisters it, and its outputs with it; the label
      // the user just read stays
      delete apiMock.players["everywhere"];
      expect(playerLabels(module)).toEqual({ everywhere: "AirPlay" });

      // back, but playing through nothing: its provider names it again
      registerPlayer("everywhere", { output_protocols: [] });
      expect(playerLabels(module)).toEqual({ everywhere: "Universal player" });
    });

    it("keeps the name a provider was given even without a manifest for it", async () => {
      addProvider("sonos--1", "sonos", ProviderType.PLAYER, {
        name: "Downstairs Sonos",
      });
      delete apiMock.providerManifests["sonos"];
      addPlayerConfig({ player_id: "living", provider: "sonos--1" });

      const module = await loadOnboardingModule();

      expect(playerLabels(module)).toEqual({ living: "Downstairs Sonos" });
    });

    it("falls back on the provider itself when a player plays through nothing", async () => {
      addPlayerConfig({ player_id: "upstairs", provider: "sync_group" });
      addPlayerConfig({
        player_id: "everywhere",
        provider: "universal_player",
      });
      apiMock.providers["sync_group"] = {
        name: "Player groups",
        domain: "sync_group",
      };
      apiMock.providerManifests["sync_group"] = {
        builtin: true,
        name: "Sync group manifest",
      };
      apiMock.providerManifests["universal_player"] = {
        builtin: true,
        name: "Universal player",
      };

      expect(playerLabels(await loadOnboardingModule())).toEqual({
        upstairs: "Player groups",
        everywhere: "Universal player",
      });
    });

    it("counts the players that are switched on", async () => {
      addPlayerConfig({ player_id: "kitchen" });
      addPlayerConfig({ player_id: "office", enabled: false });
      addPlayerConfig({
        player_id: "kitchen-airplay",
        player_type: PlayerType.PROTOCOL,
      });

      const { ctx } = await loadOnboarding();

      // the summary's "2 players" label reads this, and it says what the step
      // lists rather than what the server holds a configuration for
      expect(ctx.value.playerCount).toBe(1);
    });
  });

  describe("following the players while the wizard is open", () => {
    it("follows the events a player turns up and goes on", async () => {
      const stopFollowing = vi.fn();
      apiMock.subscribe_multi.mockReturnValue(stopFollowing);

      const { followPlayers } = await loadOnboarding();

      expect(followPlayers()).toBe(stopFollowing);
      expect(apiMock.subscribe_multi).toHaveBeenCalledOnce();
      expect(apiMock.subscribe_multi.mock.calls[0][0]).toEqual([
        EventType.PLAYER_CONFIG_UPDATED,
        EventType.PLAYER_ADDED,
        EventType.PLAYER_REMOVED,
      ]);
    });

    it("follows nothing on behalf of a role that may not read the configurations", async () => {
      signInAs({ role: "dj" }, NO_PLAYER_CONFIG_SCOPES);

      const { followPlayers } = await loadOnboarding();
      const stopFollowing = followPlayers();

      expect(apiMock.subscribe_multi).not.toHaveBeenCalled();
      // and what stops it is still something to call on the way out
      expect(() => stopFollowing()).not.toThrow();
    });

    it("takes in a player the server reports", async () => {
      const module = await loadOnboardingModule();
      module.useOnboarding().followPlayers();

      playerEventHandler()({
        event: EventType.PLAYER_CONFIG_UPDATED,
        object_id: "kitchen",
        data: playerConfig({ player_id: "kitchen", default_name: "Kitchen" }),
      });

      expect(module.discoveredPlayers().map((player) => player.name)).toEqual([
        "Kitchen",
      ]);
    });

    it("updates a player it already lists", async () => {
      addPlayerConfig({ player_id: "kitchen", default_name: "Kitchen" });

      const module = await loadOnboardingModule();
      module.useOnboarding().followPlayers();

      playerEventHandler()({
        event: EventType.PLAYER_CONFIG_UPDATED,
        object_id: "kitchen",
        data: playerConfig({
          player_id: "kitchen",
          default_name: "Kitchen",
          name: "Attic",
          enabled: false,
        }),
      });

      expect(module.discoveredPlayers()).toEqual([
        expect.objectContaining({ name: "Attic", enabled: false }),
      ]);
    });

    it("ignores a player reported before the list is asked for", async () => {
      addPlayerConfig({ player_id: "office", default_name: "Office" });
      const module = await loadModule();
      module.useOnboarding().followPlayers();

      playerEventHandler()({
        event: EventType.PLAYER_CONFIG_UPDATED,
        object_id: "kitchen",
        data: playerConfig({ player_id: "kitchen" }),
      });
      expect(module.discoveredPlayers()).toEqual([]);

      await module.useOnboarding().loadOnboardingData();
      expect(module.discoveredPlayers().map((player) => player.name)).toEqual([
        "Office",
      ]);
    });

    it("keeps a player that turns up while the list is loading", async () => {
      addPlayerConfig({ player_id: "office", default_name: "Office" });
      let handOverConfigs: (configs: PlayerConfig[]) => void = () => {};
      apiMock.getPlayerConfigs.mockImplementation(
        () =>
          new Promise<PlayerConfig[]>((resolve) => {
            handOverConfigs = resolve;
          }),
      );
      const module = await loadModule();
      module.useOnboarding().followPlayers();
      const loading = module.useOnboarding().loadOnboardingData();

      playerEventHandler()({
        event: EventType.PLAYER_CONFIG_UPDATED,
        object_id: "kitchen",
        data: playerConfig({ player_id: "kitchen", default_name: "Kitchen" }),
      });
      handOverConfigs([...playerConfigs.list]);
      await loading;

      // the answer was worked out before the player turned up, so it is
      // merged in over the list rather than replacing it
      expect(
        module
          .discoveredPlayers()
          .map((player) => player.name)
          .sort(),
      ).toEqual(["Kitchen", "Office"]);
    });

    it("fetches the configuration of a player it has not seen", async () => {
      const module = await loadOnboardingModule();
      module.useOnboarding().followPlayers();
      apiMock.getPlayerConfig.mockResolvedValue(
        playerConfig({ player_id: "office", default_name: "Office" }),
      );

      registerPlayer("office");
      playerEventHandler()({
        event: EventType.PLAYER_ADDED,
        object_id: "office",
        data: { player_id: "office", type: PlayerType.PLAYER },
      });

      expect(apiMock.getPlayerConfig).toHaveBeenCalledWith("office");
      await vi.waitFor(() =>
        expect(module.discoveredPlayers().map((player) => player.name)).toEqual(
          ["Office"],
        ),
      );
    });

    it("drops the configuration of a player that left before it came in", async () => {
      const module = await loadOnboardingModule();
      module.useOnboarding().followPlayers();
      let handOverConfig: (config: PlayerConfig) => void = () => {};
      apiMock.getPlayerConfig.mockImplementation(
        () =>
          new Promise<PlayerConfig>((resolve) => {
            handOverConfig = resolve;
          }),
      );

      registerPlayer("office");
      playerEventHandler()({
        event: EventType.PLAYER_ADDED,
        object_id: "office",
        data: { player_id: "office", type: PlayerType.PLAYER },
      });
      // gone again before its configuration came in
      delete apiMock.players["office"];
      playerEventHandler()({
        event: EventType.PLAYER_REMOVED,
        object_id: "office",
      });
      handOverConfig(playerConfig({ player_id: "office" }));
      await flushPromises();

      expect(apiMock.getPlayerConfig).toHaveBeenCalledOnce();
      expect(module.discoveredPlayers()).toEqual([]);
    });

    it("fetches nothing for a player it lists or one that is another's output", async () => {
      addPlayerConfig({ player_id: "kitchen" });

      const module = await loadOnboardingModule();
      module.useOnboarding().followPlayers();

      // a player seen before only came back; a protocol player is configured
      // as part of the player it plays for and is never listed on its own
      playerEventHandler()({
        event: EventType.PLAYER_ADDED,
        object_id: "kitchen",
        data: { player_id: "kitchen", type: PlayerType.PLAYER },
      });
      playerEventHandler()({
        event: EventType.PLAYER_ADDED,
        object_id: "kitchen-airplay",
        data: { player_id: "kitchen-airplay", type: PlayerType.PROTOCOL },
      });

      expect(apiMock.getPlayerConfig).not.toHaveBeenCalled();
      expect(module.discoveredPlayers()).toHaveLength(1);
    });

    it("drops a player that was switched on when it leaves", async () => {
      addPlayerConfig({ player_id: "kitchen" });

      const module = await loadOnboardingModule();
      module.useOnboarding().followPlayers();

      playerEventHandler()({
        event: EventType.PLAYER_REMOVED,
        object_id: "kitchen",
      });

      expect(module.discoveredPlayers()).toEqual([]);
    });

    it("keeps a player that only unregistered because it was switched off", async () => {
      addPlayerConfig({ player_id: "kitchen", enabled: false });

      const module = await loadOnboardingModule();
      module.useOnboarding().followPlayers();

      playerEventHandler()({
        event: EventType.PLAYER_REMOVED,
        object_id: "kitchen",
      });

      // switching it off is what unregistered it, and the wizard is where it
      // is switched back on
      expect(module.discoveredPlayers()).toHaveLength(1);
    });
  });

  describe("the own-sources invitation", () => {
    it("can add its own sources when the role holds the scope", async () => {
      signInAs({}, BUILTIN_ROLE_SCOPES.user);

      const { ctx } = await loadOnboarding();

      expect(ctx.value.canOwnSources).toBe(true);
    });

    it("cannot when the role does not hold the scope", async () => {
      signInAs({}, MEMBER_WITHOUT_OWN_SCOPES);

      const { ctx } = await loadOnboarding();

      expect(ctx.value.canOwnSources).toBe(false);
    });

    it("counts and lists only the sources this member owns", async () => {
      signInAs({ user_id: "sam-1" }, BUILTIN_ROLE_SCOPES.user);
      addOwnedSource("spotify--1", "spotify", "sam-1");
      addOwnedSource("tidal--1", "tidal", "sam-1");
      // owned by someone else in the household: not this member's to count
      addOwnedSource("qobuz--1", "qobuz", "alex-1");

      const { ctx, ownedMusicSources } = await loadOnboarding();

      expect(ctx.value.ownedMusicSourceCount).toBe(2);
      expect(
        ownedMusicSources.value.map((config) => config.instance_id),
      ).toEqual(["spotify--1", "tidal--1"]);
    });

    it("counts none while every source belongs to someone else", async () => {
      signInAs({ user_id: "sam-1" }, BUILTIN_ROLE_SCOPES.user);
      addOwnedSource("qobuz--1", "qobuz", "alex-1");

      const { ctx, ownedMusicSources } = await loadOnboarding();

      expect(ctx.value.ownedMusicSourceCount).toBe(0);
      expect(ownedMusicSources.value).toEqual([]);
    });

    it("ticks the step off once the member owns a source", async () => {
      signInAs({ user_id: "sam-1" }, BUILTIN_ROLE_SCOPES.user);
      addOwnedSource("spotify--1", "spotify", "sam-1");

      const { steps, ctx } = await loadOnboarding();

      const ownSources = steps.value.find((step) => step.id === "own_sources")!;
      expect(ownSources.isDone(ctx.value)).toBe(true);
    });
  });

  describe("the welcome", () => {
    it("writes the answer as the expert mode flag, and nothing else", async () => {
      signInAs();

      const { setExpertMode } = await loadOnboarding();
      await expect(setExpertMode(true)).resolves.toBe(true);

      // one flag: what it changes is read from it wherever it applies, and
      // one message if it fails: the step has something of its own to say, so
      // the api stays quiet
      expect(setUserPreferencesMock).toHaveBeenCalledOnce();
      expect(setUserPreferencesMock).toHaveBeenCalledWith(
        { expert_mode: true },
        { suppressGlobalError: true },
      );
    });

    it("moves the flag when the member answers again", async () => {
      signInAs();
      preferenceState.expertMode.value = true;

      const { setExpertMode } = await loadOnboarding();
      await setExpertMode(false);

      expect(setUserPreferencesMock).toHaveBeenCalledWith(
        { expert_mode: false },
        { suppressGlobalError: true },
      );
    });

    it("reads an answer an earlier welcome wrote as a persona", async () => {
      signInAs();
      preferenceState.legacyPersona.value = "enthusiast";

      const { ctx, pending } = await loadOnboarding();

      // the old answer still counts as the expert experience, so nothing is
      // asked again and the summary can look back at it
      expect(ctx.value.answers.expert).toBe(true);
      expect(pending.value).toEqual([]);
    });

    it("marks the member as welcomed on the way out", async () => {
      signInAs();

      const { active, open, finish } = await loadOnboarding();
      open();
      await expect(finish()).resolves.toBe(true);

      // nothing is closed off on the server: the setup is the admin's, and
      // the member's own account is all the welcome leaves a mark on
      expect(apiMock.sendCommand).not.toHaveBeenCalled();
      expect(setUserPreferencesMock).toHaveBeenCalledOnce();
      const [values] = setUserPreferencesMock.mock.calls[0];
      const marker = (values as Record<string, string>)["onboarding.welcome"];
      expect(Date.parse(marker)).not.toBeNaN();
      expect(active.value).toBe(false);
    });

    it("keeps the member here when the mark could not be made", async () => {
      signInAs();
      setUserPreferencesMock.mockResolvedValue(false);

      const { active, open, finish } = await loadOnboarding();
      open();
      await expect(finish()).resolves.toBe(false);

      // handing them back to the app now would only welcome them again on the
      // next reload, so the wizard stays put and says so — once: the api keeps
      // its own message to itself here
      expect(setUserPreferencesMock).toHaveBeenCalledWith(expect.anything(), {
        suppressGlobalError: true,
      });
      expect(toastMock.error).toHaveBeenCalledOnce();
      expect(toastMock.error).toHaveBeenCalledWith("onboarding.finish_failed");
      expect(active.value).toBe(true);
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

      const { active, open, finish } = await loadOnboarding();
      open();
      await expect(finish()).resolves.toBe(true);

      // when they were welcomed, not when they last looked it over again
      expect(setUserPreferencesMock).not.toHaveBeenCalled();
      expect(active.value).toBe(false);
    });

    it("hands a failed answer back to whoever asked the question", async () => {
      signInAs();
      setUserPreferencesMock.mockResolvedValue(false);

      const { setExpertMode } = await loadOnboarding();

      // the step has something to tell the user; this only says what happened
      await expect(setExpertMode(false)).resolves.toBe(false);
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

      const { ctx, pending } = await loadOnboarding();

      // they have seen it, whatever they made of it: nothing left to ask
      expect(ctx.value.welcomed).toBe(true);
      expect(pending.value).toEqual([]);
    });

    it("keeps asking the member who is being welcomed right now", async () => {
      signInAs();

      const { ctx, pending } = await loadOnboarding();

      // the marker is written on the way out, so the question is open for the
      // whole of this run — and the summary says so
      expect(ctx.value.welcomed).toBe(false);
      expect(pending.value.map((step) => step.id)).toEqual(["welcome"]);
    });
  });
});
