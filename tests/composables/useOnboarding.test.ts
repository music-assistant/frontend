import {
  EventType,
  PlayerType,
  ProviderType,
  type EventMessage,
  type Player,
  type PlayerConfig,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { outputProtocol } from "../fixtures/outputProtocol";
import { playerConfig } from "../fixtures/playerConfig";

const {
  apiMock,
  playerConfigs,
  preferenceState,
  providerConfigs,
  routerMock,
  setUserPreferenceMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    // the players that registered, which is where a player's live state is
    players: {} as Record<string, Partial<Player>>,
    // the instances that loaded, which name a provider that has no custom name
    providers: {} as Record<string, { name: string; domain?: string }>,
    providerManifests: {} as Record<string, { builtin: boolean; name: string }>,
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
  // what the server hands back as the player configurations
  playerConfigs: { list: [] as PlayerConfig[] },
  // replaced with a real ref by the userPreferences mock factory below, so
  // the composable's computed context follows what a test sets here
  preferenceState: {
    intent: { value: undefined } as { value?: string },
  },
  // what the server hands back as the provider configurations
  providerConfigs: { list: [] as Record<string, unknown>[] },
  routerMock: { replace: vi.fn(), push: vi.fn() },
  setUserPreferenceMock: vi.fn(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  preferenceState.intent = ref<string | undefined>(undefined);
  const preferences: Record<string, { value?: string }> = {
    "onboarding.intent": preferenceState.intent,
  };
  return {
    setUserPreference: setUserPreferenceMock,
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

/** The composable with the provider and player configurations already in. */
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

/**
 * A complete player config, for tests that only care about a few of its
 * fields but should still model a payload the server can send.
 */

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
    apiMock.getProviderConfigs.mockReset();
    apiMock.getProviderConfigs.mockImplementation(async () => [
      ...providerConfigs.list,
    ]);
    apiMock.getPlayerConfigs.mockReset();
    apiMock.getPlayerConfigs.mockImplementation(async () => [
      ...playerConfigs.list,
    ]);
    apiMock.getPlayerConfig.mockReset();
    apiMock.subscribe.mockClear();
    apiMock.subscribe_multi.mockReset();
    apiMock.subscribe_multi.mockImplementation(() => vi.fn());
    apiMock.sendCommand.mockReset();
    apiMock.sendCommand.mockResolvedValue(undefined);
    apiMock.serverInfo.value = { onboard_done: false };
    // answers as the real one does: a promise, and whether it landed
    setUserPreferenceMock.mockReset();
    setUserPreferenceMock.mockResolvedValue(true);
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
    ]);
  });

  it("runs the setup through its steps in their base order", async () => {
    const { steps } = await loadOnboarding();

    expect(steps.value.map((step) => step.id)).toEqual([
      "intent",
      "music_sources",
      "players",
      "plugins",
      "core_settings",
      "finish",
    ]);
  });

  it("decides nothing before the onboarding data is in", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const module = await loadModule();
    const { ctx, loadOnboardingData } = module.useOnboarding();

    expect(ctx.value.providers).toEqual([]);
    expect(module.configuredProviders(ProviderType.MUSIC)).toEqual([]);
    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
    expect(apiMock.getPlayerConfigs).not.toHaveBeenCalled();

    await loadOnboardingData();

    expect(ctx.value.providers).toHaveLength(1);
    expect(module.configuredProviders(ProviderType.MUSIC)).toHaveLength(1);
  });

  it("asks for everything it needs once while a load is in flight", async () => {
    let handOverConfigs: (configs: unknown[]) => void = () => {};
    apiMock.getProviderConfigs.mockImplementation(
      () =>
        new Promise((resolve) => {
          handOverConfigs = resolve;
        }),
    );
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const { ctx, loadOnboardingData } = (await loadModule()).useOnboarding();
    const both = Promise.all([loadOnboardingData(), loadOnboardingData()]);

    expect(apiMock.getProviderConfigs).toHaveBeenCalledOnce();
    expect(apiMock.getPlayerConfigs).toHaveBeenCalledOnce();

    handOverConfigs([...providerConfigs.list]);
    await both;

    expect(ctx.value.providers).toHaveLength(1);
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

    const { ctx, pending } = await loadOnboarding();

    // the api toasts its own failures; the wizard simply has nothing to show
    expect(ctx.value.providers).toEqual([]);
    expect(pending.value.map((step) => step.id)).toContain("music_sources");
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

  it("lists no players when they cannot be loaded", async () => {
    addPlayerConfig();
    apiMock.getPlayerConfigs.mockRejectedValue(new Error("boom"));

    const module = await loadOnboardingModule();

    // the api toasts its own failures; the step simply has nothing to show
    expect(module.discoveredPlayers()).toEqual([]);
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
    ]);
  });

  it("leaves only the optional steps pending once the core is set up", async () => {
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const { pending } = await loadOnboarding();
    preferenceState.intent.value = "music_hub";

    // the plugins are optional, but still pending until done
    expect(pending.value.map((step) => step.id)).toEqual(["plugins"]);
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

  it("opens a paused setup again on the step it was on", async () => {
    const { open, pause, close, active, paused, requestedStep } =
      await loadOnboarding();
    open("players");

    await pause();
    expect(active.value).toBe(false);
    expect(paused.value).toBe(true);

    open();
    expect(active.value).toBe(true);
    expect(paused.value).toBe(false);
    expect(requestedStep.value).toBe("players");

    // a setup that is closed for good starts over from what is left to do
    close();
    open();
    expect(requestedStep.value).toBeNull();
  });

  it("keeps a paused setup aside once the banner is dismissed", async () => {
    const {
      open,
      pause,
      dismissPaused,
      paused,
      showPausedBanner,
      requestedStep,
    } = await loadOnboarding();
    open("players");
    await pause();

    dismissPaused();
    expect(showPausedBanner.value).toBe(false);
    expect(paused.value).toBe(true);
    expect(requestedStep.value).toBe("players");

    open();
    await pause();
    expect(showPausedBanner.value).toBe(true);
  });

  it("lets go when the user leaves the page while a pause is still saving", async () => {
    const { open, pause, setStepGuard, active, paused } =
      await loadOnboarding();
    let answer: (saved: boolean) => void = () => undefined;
    setStepGuard(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    open();

    const closing = pause();
    await pause({ force: true });
    expect(active.value).toBe(false);

    // the save that was on its way fails, and the wizard stays gone
    answer(false);
    await closing;
    expect(active.value).toBe(false);
    expect(paused.value).toBe(true);
  });

  it("leaves a wizard resumed while an older pause was saving open", async () => {
    const { open, pause, setStepGuard, active } = await loadOnboarding();
    let answer: (saved: boolean) => void = () => undefined;
    setStepGuard(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    open();

    const closing = pause();
    await pause({ force: true });
    open();

    // the older save lands, and the resumed wizard stays
    answer(true);
    await closing;
    expect(active.value).toBe(true);
  });

  it("keeps the guard of a wizard that took over from one going away", async () => {
    const { open, pause, setStepGuard, active } = await loadOnboarding();
    const removeOld = setStepGuard(async () => true);
    setStepGuard(async () => false);
    removeOld();
    open();

    await pause();

    expect(active.value).toBe(true);
  });

  it("lets the step on screen save before it pauses", async () => {
    const { open, pause, setStepGuard, active } = await loadOnboarding();
    const guard = vi.fn().mockResolvedValue(false);
    setStepGuard(guard);
    open();

    // a step that could not save keeps the wizard open
    await pause();
    expect(guard).toHaveBeenCalledOnce();
    expect(active.value).toBe(true);

    // unless the user has already gone to another page
    await pause({ force: true });
    expect(active.value).toBe(false);
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
});
