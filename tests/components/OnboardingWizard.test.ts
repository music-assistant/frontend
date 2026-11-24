import {
  EventType,
  ProviderOffering,
  ProviderType,
  ProviderStatus,
  UserRole,
  type EventMessage,
  type Scope,
  type User,
} from "@/plugins/api/interfaces";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerConfig } from "../fixtures/playerConfig";
import {
  BUILTIN_ROLE_SCOPES,
  MEMBER_WITHOUT_OWN_SCOPES,
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
  startTourMock,
  storeState,
  users,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providers: {} as Record<string, { name: string }>,
    providerManifests: {} as Record<
      string,
      {
        builtin: boolean;
        name?: string;
        type?: ProviderType;
        provides?: ProviderOffering[];
      }
    >,
    getAllUsers: vi.fn(),
    getAIEngines: vi.fn(async () => []),
    getAIUsage: vi.fn(async () => []),
    configureRemoteAccess: vi.fn(),
    getPlayerConfig: vi.fn(),
    getPlayerConfigs: vi.fn(),
    getProvider: vi.fn(),
    getProviderConfig: vi.fn(),
    getProviderConfigs: vi.fn(),
    getRemoteAccessInfo: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    subscribe_multi:
      vi.fn<
        (
          events: EventType[],
          handler: (evt: EventMessage) => void,
        ) => () => void
      >(),
    sendCommand: vi.fn(),
    serverInfo: {
      value: {
        onboard_done: false,
        server_id: "server-1",
        internal_url: "http://192.168.1.10:8095",
        has_remote_access: false,
        homeassistant_addon: true,
      },
    },
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>(), setToken: vi.fn() },
  // replaced with real refs by the userPreferences mock factory below
  preferenceState: {
    intent: { value: undefined } as { value?: string },
    expertMode: { value: undefined } as { value?: boolean },
    welcomedAt: { value: undefined } as { value?: string },
    ready: false,
  },
  // what the server hands back as the provider configurations
  providerConfigs: { list: [] as Record<string, unknown>[] },
  routerMock: { push: vi.fn(), replace: vi.fn() },
  setUserPreferenceMock: vi.fn(),
  setUserPreferencesMock: vi.fn(),
  startTourMock: vi.fn(),
  // replaced with a reactive store by the store mock factory below: who is
  // signed in is what tells the setup wizard from the welcome
  storeState: {
    store: { currentUser: undefined } as { currentUser?: User },
    ready: false,
  },
  // what the server hands back as the user accounts
  users: { list: [] as ReturnType<typeof user>[] },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

// the step counter shows its numbers, so a test can read where the wizard is
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, named?: { current?: number; total?: number }) =>
    key === "onboarding.step_counter"
      ? `${named?.current}/${named?.total}`
      : key,
}));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// the tour is the layout's to run; here it only has to be asked for
vi.mock("@/composables/useTour", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useTour: () => ({ active: ref(false), start: startTourMock, end: vi.fn() }),
  };
});

// the dialogs are covered where they live; here they only have to be reachable
vi.mock("@/views/settings/AddProviderDialog.vue", () => ({
  default: {
    name: "AddProviderDialog",
    props: ["show", "providerType", "audioSourceOnly"],
    template: "<div />",
  },
}));

// the player actions are covered where they live, and pulling them in would
// drag the player menus and everything behind them into this mount
vi.mock("@/helpers/player_settings_actions", () => ({
  renamePlayer: vi.fn(),
  setPlayerEnabled: vi.fn(),
}));

vi.mock("@/components/users/CreateUserDialog.vue", () => ({
  default: {
    name: "CreateUserDialog",
    props: ["modelValue"],
    template: "<div />",
  },
}));

// the icon reaches for a Vuetify theme this bare mount does not set up
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<i />",
  },
}));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  // every test loads a fresh wizard, which runs this factory again: hand out
  // the same store, so the user a test signed in survives the reload
  if (!storeState.ready) {
    storeState.store = reactive({ currentUser: undefined as User | undefined });
    storeState.ready = true;
  }
  return { store: storeState.store };
});

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  if (!preferenceState.ready) {
    preferenceState.intent = ref<string | undefined>(undefined);
    preferenceState.expertMode = ref<boolean | undefined>(undefined);
    preferenceState.welcomedAt = ref<string | undefined>(undefined);
    preferenceState.ready = true;
  }
  const preferences: Record<string, { value?: string | boolean }> = {
    "onboarding.intent": preferenceState.intent,
    expert_mode: preferenceState.expertMode,
    "onboarding.welcome": preferenceState.welcomedAt,
  };
  return {
    setUserPreference: setUserPreferenceMock,
    setUserPreferences: setUserPreferencesMock,
    useUserPreferences: () => ({
      // a preference nothing here sets reads as unset, like on a fresh account
      getPreference: (key: string) => preferences[key] ?? ref(undefined),
    }),
  };
});

// The wizard pulls its whole step graph in behind it: the provider listings,
// the welcome's cards and the players and music that are here. Every
// test mounts it on a fresh module registry, so the transform of all that is
// paid at module scope, where no test or hook clock runs, instead of by
// whichever test happens to mount first.
await import("@/components/onboarding/OnboardingWizard.vue");

/**
 * A fresh wizard per test: the onboarding state lives for a whole session.
 * `step` sets the composable's requested step, which the wizard opens on the
 * same way a deep link does; `fresh: false` reopens on the state a first visit
 * left behind.
 */
async function mountWizard({
  fresh = true,
  step,
  attach = false,
}: { fresh?: boolean; step?: OnboardingStepId; attach?: boolean } = {}) {
  if (fresh) vi.resetModules();
  // the wizard reads the requested step from the same composable instance it
  // imports, so it has to be set on that instance before the wizard mounts
  if (step !== undefined) {
    const { useOnboarding } = await import("@/composables/useOnboarding");
    useOnboarding().open(step);
  }
  const component =
    await import("@/components/onboarding/OnboardingWizard.vue");
  return mount(component.default, {
    global: { mocks: { $t: (key: string) => key } },
    // in the document, for a button that submits a form by its id
    attachTo: attach ? document.body : undefined,
  });
}

function addProvider(
  instanceId: string,
  domain: string,
  type: ProviderType,
  name?: string,
) {
  providerConfigs.list.push({
    instance_id: instanceId,
    domain,
    type,
    name: name ?? null,
    enabled: true,
    last_error: null,
  });
  apiMock.providerManifests[domain] = { builtin: false };
}

/** A plugin that lets an app play to Music Assistant. */
function addAudioSourcePlugin(instanceId: string, domain: string) {
  addProvider(instanceId, domain, ProviderType.PLUGIN);
  apiMock.providerManifests[domain] = {
    builtin: false,
    type: ProviderType.PLUGIN,
    provides: [ProviderOffering.AUDIO_SOURCE],
  };
}

/** A plugin that brings AI or speech. */
function addAIService(instanceId: string, domain: string) {
  addProvider(instanceId, domain, ProviderType.PLUGIN);
  apiMock.providerManifests[domain] = {
    builtin: false,
    type: ProviderType.PLUGIN,
    provides: [ProviderOffering.AI],
  };
}

function addMusicProvider() {
  addProvider("spotify--1", "spotify", ProviderType.MUSIC, "Spotify");
}

/** Everything the wizard asks for bar the household. */
function addEveryProvider() {
  addMusicProvider();
  addProvider("sonos--1", "sonos", ProviderType.PLAYER);
  addProvider("party--1", "party", ProviderType.PLUGIN);
  addAIService("openai--1", "openai_compatible");
}

function addMember(userId: string) {
  users.list.push(user({ user_id: userId, username: userId }));
}

/**
 * Sign in as someone who lives here without running the place. Defaults to a
 * member who may not add sources of their own; pass scopes for a role that can.
 */
function signInAsMember(scopes: readonly Scope[] = MEMBER_WITHOUT_OWN_SCOPES) {
  authMock.hasScope.mockImplementation(scopeChecker(scopes));
  storeState.store.currentUser = user({
    user_id: "sam-1",
    username: "sam",
    display_name: "Sam",
    role: UserRole.USER,
  });
}

// the footer's way on: Next, or Skip for now on a step not set up yet
const FORWARD = "[data-testid=onboarding-next], [data-testid=onboarding-skip]";

function heading(wrapper: Awaited<ReturnType<typeof mountWizard>>) {
  return wrapper.find("[data-testid=onboarding-heading]").text();
}

/** Answer the setup question with a card, which is also the way on. */
async function pickIntent(
  wrapper: Awaited<ReturnType<typeof mountWizard>>,
  intent: string,
) {
  await wrapper
    .find(`[data-testid=onboarding-intent-${intent}]`)
    .trigger("click");
  await flushPromises();
}

/** Answer the welcome with a card, which is also the way on. */
async function pickExperience(
  wrapper: Awaited<ReturnType<typeof mountWizard>>,
  experience: string,
) {
  await wrapper
    .find(`[data-testid=onboarding-experience-${experience}]`)
    .trigger("click");
  await flushPromises();
}

/**
 * The step counter as "current/total", checked against the progress list it
 * counts; null when the step on screen is not part of the numbered setup.
 */
function stepCount(wrapper: Awaited<ReturnType<typeof mountWizard>>) {
  const counter = wrapper.find("[data-testid=onboarding-step-counter]");
  if (!counter.exists()) {
    expect(wrapper.find("[data-testid=onboarding-progress]").exists()).toBe(
      false,
    );
    return null;
  }
  const dots = wrapper.findAll("[data-testid=onboarding-progress-step]");
  const current = dots.findIndex((dot) => dot.attributes("aria-current"));
  expect(counter.text()).toBe(`${current + 1}/${dots.length}`);
  return counter.text();
}

/**
 * The wizard as a fresh server opens it: sent to the server's setup page,
 * before there is an account to sign in with, let alone permissions.
 */
async function mountFirstRunWizard({ attach = false } = {}) {
  vi.resetModules();
  window.history.replaceState({}, "", "/setup");
  const { enterFirstRunSetup } = await import("@/composables/useFirstRunSetup");
  expect(enterFirstRunSetup()).toBe(true);
  storeState.store.currentUser = undefined;
  authMock.hasScope.mockReturnValue(false);
  return await mountWizard({ fresh: false, attach });
}

/** Past the first run's welcome, onto the account step. */
async function getStarted(wrapper: Awaited<ReturnType<typeof mountWizard>>) {
  await wrapper.find(FORWARD).trigger("click");
  await flushPromises();
  expect(heading(wrapper)).toBe("onboarding.steps.account.title");
}

/** The app signing in with the admin account the first run made. */
function signInAsNewAdmin() {
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  storeState.store.currentUser = user({
    user_id: "admin-1",
    username: "admin",
    role: UserRole.ADMIN,
  });
}

/** The welcome answers written to the account, in the order they went out. */
function expertAnswers(): boolean[] {
  return setUserPreferencesMock.mock.calls
    .map(([values]) => values["expert_mode"])
    .filter((answer) => answer != null);
}

/** Tell the wizard the server reported a provider change. */
async function reportProvidersUpdated() {
  const lastCall = apiMock.subscribe.mock.calls.at(-1) as unknown as [
    string,
    () => void,
  ];
  lastCall[1]();
  await flushPromises();
}

let originalUrl: string;

beforeEach(() => {
  originalUrl = window.location.href;
});

// every test mounts the wizard on a fresh module registry, which is its whole
// step graph evaluated again and can take seconds under load
// hand back the address bar a first run rewrote
afterEach(() => {
  window.history.replaceState({}, "", originalUrl);
});

describe("Onboarding wizard", { timeout: 20_000 }, () => {
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
    apiMock.getPlayerConfigs.mockReset();
    apiMock.getPlayerConfigs.mockResolvedValue([]);
    apiMock.getPlayerConfig.mockReset();
    apiMock.getProviderConfig.mockReset();
    apiMock.getAllUsers.mockReset();
    apiMock.getAllUsers.mockImplementation(async () => [...users.list]);
    apiMock.getRemoteAccessInfo.mockReset();
    apiMock.configureRemoteAccess.mockReset();
    apiMock.sendCommand.mockReset();
    // the add-on connects Home Assistant by itself, so only the tests of the
    // Home Assistant step run on a server that is not the add-on
    apiMock.serverInfo.value.homeassistant_addon = true;
    apiMock.subscribe.mockClear();
    apiMock.subscribe_multi.mockReset();
    apiMock.subscribe_multi.mockImplementation(() => vi.fn());
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    storeState.store.currentUser = user({
      user_id: "admin-1",
      username: "admin",
      role: UserRole.ADMIN,
    });
    preferenceState.intent.value = undefined;
    preferenceState.expertMode.value = undefined;
    preferenceState.welcomedAt.value = undefined;
    routerMock.push.mockReset();
    routerMock.replace.mockReset();
    setUserPreferenceMock.mockReset();
    setUserPreferencesMock.mockReset();
    startTourMock.mockReset();
    // the real ones update the preferences before they ever reach the server,
    // and say whether the server took them
    setUserPreferenceMock.mockImplementation(
      async (key: string, value: string) => {
        if (key === "onboarding.intent") preferenceState.intent.value = value;
        return true;
      },
    );
    setUserPreferencesMock.mockImplementation(
      async (values: Record<string, string | boolean>) => {
        const answer = values["expert_mode"];
        if (typeof answer === "boolean")
          preferenceState.expertMode.value = answer;
        const welcomed = values["onboarding.welcome"];
        if (typeof welcomed === "string")
          preferenceState.welcomedAt.value = welcomed;
        // the real one says whether the server took it
        return true;
      },
    );
  });

  it("opens on the first step still to do", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
    // nothing to go back to on the first step
    expect(wrapper.find("[data-testid=onboarding-back]").exists()).toBe(false);

    wrapper.unmount();
  });

  it("uses the app-connection title in the heading, progress and finish link", async () => {
    preferenceState.intent.value = "phone_apps";
    addProvider("party--1", "party", ProviderType.PLUGIN);
    const wrapper = await mountWizard({ step: "plugins" });
    await flushPromises();

    const title = "onboarding.steps.plugins.phone_apps_title";
    expect(heading(wrapper)).toBe(title);
    expect(wrapper.find("[aria-current=step]").attributes("aria-label")).toBe(
      title,
    );
    expect(wrapper.find("[data-testid=onboarding-primary-action]").text()).toBe(
      "onboarding.steps.plugins.connect",
    );
    expect(wrapper.find("[data-testid=onboarding-skip]").text()).toBe(
      "onboarding.skip",
    );

    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.finish.title");

    const link = wrapper
      .findAll("[data-testid=onboarding-summary-pending]")
      .find((item) => item.text().includes(title));
    expect(link).toBeDefined();
    expect(
      wrapper.find("[data-testid=onboarding-receiver-instructions]").exists(),
    ).toBe(false);
    await link!.trigger("click");
    expect(heading(wrapper)).toBe(title);
    wrapper.unmount();
  });

  it("lists and offers only the plugins that let an app play when connecting music apps", async () => {
    preferenceState.intent.value = "phone_apps";
    addAudioSourcePlugin("spotify-connect--1", "spotify_connect");
    addProvider("party--1", "party", ProviderType.PLUGIN);
    const wrapper = await mountWizard({ step: "plugins" });
    try {
      await flushPromises();

      expect(
        wrapper
          .findAll("[data-testid=onboarding-configured-provider]")
          .map((item) =>
            item.findComponent({ name: "ProviderIcon" }).props("domain"),
          ),
      ).toEqual(["spotify_connect"]);
      expect(
        wrapper.findComponent({ name: "AddProviderDialog" }).props(),
      ).toMatchObject({
        providerType: ProviderType.PLUGIN,
        audioSourceOnly: true,
      });
    } finally {
      wrapper.unmount();
    }
  });

  it("opens a connected app's settings on top of the wizard", async () => {
    preferenceState.intent.value = "phone_apps";
    addAudioSourcePlugin("spotify-connect--1", "spotify_connect");
    // the settings stay on their way, so the dialog is caught as it opens
    apiMock.getProviderConfig.mockReturnValue(new Promise(() => {}));
    const wrapper = await mountWizard({ step: "plugins" });
    try {
      await flushPromises();

      // the step says how to choose the speakers, which is what the row does
      expect(wrapper.text()).toContain(
        "onboarding.steps.plugins.phone_apps_instructions",
      );
      await wrapper
        .find("[data-testid=onboarding-configured-provider]")
        .trigger("click");
      await flushPromises();

      expect(apiMock.getProviderConfig).toHaveBeenCalledWith(
        "spotify-connect--1",
      );
      expect(
        document.body.querySelector("[data-testid=provider-settings-dialog]"),
      ).not.toBeNull();
      // the wizard stays where it is: going to the settings page would pause it
      expect(heading(wrapper)).toBe(
        "onboarding.steps.plugins.phone_apps_title",
      );
      expect(routerMock.push).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });

  it("offers every music source in the full setup", async () => {
    preferenceState.intent.value = "music_hub";
    const wrapper = await mountWizard({ step: "music_sources" });
    try {
      await flushPromises();

      expect(
        wrapper.findComponent({ name: "AddProviderDialog" }).props(),
      ).toMatchObject({
        providerType: ProviderType.MUSIC,
        audioSourceOnly: false,
      });
    } finally {
      wrapper.unmount();
    }
  });

  it("finishes existing-app setup without library, user setup or a tour offer", async () => {
    preferenceState.intent.value = "phone_apps";
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);
    addAudioSourcePlugin("spotify-connect--1", "spotify_connect");
    const wrapper = await mountWizard({ step: "finish" });
    await flushPromises();

    expect(
      wrapper.find("[data-testid=onboarding-summary-pending]").exists(),
    ).toBe(false);
    expect(wrapper.text()).not.toContain("onboarding.still_to_do");
    // the recap names the choice made, not the question that asked for it
    const choice = wrapper.findAll("[data-testid=onboarding-summary-done]")[0];
    expect(choice.text()).toContain("onboarding.steps.intent.summary_title");
    expect(choice.text()).toContain("onboarding.steps.intent.phone_apps.title");
    expect(choice.text()).not.toContain("onboarding.steps.intent.title");
    expect(wrapper.text()).toContain(
      "onboarding.steps.finish.phone_apps_description",
    );
    expect(wrapper.text()).toContain("onboarding.spotify_connect_hint");
    expect(
      wrapper.find("[data-testid=onboarding-summary-optional]").exists(),
    ).toBe(false);
    expect(wrapper.find("[data-testid=onboarding-tour]").exists()).toBe(false);
    wrapper.unmount();
  });

  it("walks existing-app setup from the choice through speakers and apps to the finish", async () => {
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);
    addAudioSourcePlugin("spotify-connect--1", "spotify_connect");
    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    // the choice comes before the setup it leads into, so it is not counted
    expect(stepCount(wrapper)).toBeNull();
    await pickIntent(wrapper, "phone_apps");
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");
    expect(stepCount(wrapper)).toBe("1/3");
    for (const [title, count] of [
      ["onboarding.steps.plugins.phone_apps_title", "2/3"],
      ["onboarding.steps.finish.title", "3/3"],
    ]) {
      await wrapper.find(FORWARD).trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe(title);
      expect(stepCount(wrapper)).toBe(count);
    }

    expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
    await wrapper.find("[data-testid=onboarding-back]").trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.plugins.phone_apps_title");
    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();
    await wrapper.find("[data-testid=onboarding-finish]").trigger("click");
    await flushPromises();
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      "config/onboard_complete",
      undefined,
      { suppressGlobalError: true },
    );
    expect(startTourMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not show app playback instructions after full-experience setup", async () => {
    preferenceState.intent.value = "music_hub";
    addAudioSourcePlugin("spotify-connect--1", "spotify_connect");
    addAudioSourcePlugin("airplay--1", "airplay_receiver");
    const wrapper = await mountWizard({ step: "finish" });
    try {
      await flushPromises();

      expect(wrapper.text()).not.toContain("onboarding.listen_from_apps");
      expect(
        wrapper.find("[data-testid=onboarding-receiver-instructions]").exists(),
      ).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  it("gives app-setup listening instructions only for configured, enabled receivers without errors", async () => {
    preferenceState.intent.value = "phone_apps";
    addAudioSourcePlugin("spotify-connect--1", "spotify_connect");
    addAudioSourcePlugin("airplay--1", "airplay_receiver");
    addProvider("party--1", "party", ProviderType.PLUGIN);
    const wrapper = await mountWizard({ step: "finish" });
    await flushPromises();

    expect(
      wrapper
        .findAll("[data-testid=onboarding-receiver-instructions]")
        .map((item) => item.text()),
    ).toEqual([
      expect.stringContaining("onboarding.spotify_connect_hint"),
      expect.stringContaining("onboarding.airplay_receiver_hint"),
    ]);

    providerConfigs.list[0].enabled = false;
    providerConfigs.list[1].last_error = "Setup failed";
    await reportProvidersUpdated();
    expect(
      wrapper.find("[data-testid=onboarding-receiver-instructions]").exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it("offers to connect Home Assistant before the finish on a server that is not the add-on", async () => {
    apiMock.serverInfo.value.homeassistant_addon = false;
    preferenceState.intent.value = "phone_apps";
    const wrapper = await mountWizard({ step: "plugins" });
    try {
      await flushPromises();

      await wrapper.find(FORWARD).trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.home_assistant.title");
      expect(stepCount(wrapper)).toBe("3/4");
      expect(
        wrapper.find("[data-testid=onboarding-primary-action]").text(),
      ).toBe("onboarding.steps.home_assistant.connect");
      // optional, so it can be skipped on the way to the finish
      expect(wrapper.find("[data-testid=onboarding-skip]").text()).toBe(
        "onboarding.skip",
      );

      await wrapper.find(FORWARD).trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.finish.title");
    } finally {
      wrapper.unmount();
    }
  });

  it("connects Home Assistant before remote access in the full setup on a server that is not the add-on", async () => {
    apiMock.serverInfo.value.homeassistant_addon = false;
    preferenceState.intent.value = "music_hub";
    addEveryProvider();
    addProvider("hass--1", "hass", ProviderType.PLUGIN, "Home Assistant");
    providerConfigs.list.at(-1)!.status = ProviderStatus.LOADED;
    const wrapper = await mountWizard({ step: "players" });
    try {
      await flushPromises();
      expect(stepCount(wrapper)).toBe("2/7");

      for (const [title, count] of [
        ["onboarding.steps.home_assistant.title", "3/7"],
        ["onboarding.steps.core_settings.away_title", "4/7"],
      ]) {
        await wrapper.find(FORWARD).trigger("click");
        await flushPromises();
        expect(heading(wrapper)).toBe(title);
        expect(stepCount(wrapper)).toBe(count);
      }
      // connected one step earlier, so remote access can say it goes through
      // Home Assistant Link
      expect(wrapper.text()).toContain(
        "onboarding.steps.core_settings.remote.features.home_assistant_link",
      );
    } finally {
      wrapper.unmount();
    }
  });

  it("shows a Home Assistant connection that is set up instead of the connect button", async () => {
    apiMock.serverInfo.value.homeassistant_addon = false;
    preferenceState.intent.value = "music_hub";
    addProvider("hass--1", "hass", ProviderType.PLUGIN, "Home Assistant");
    const wrapper = await mountWizard({ step: "home_assistant" });
    try {
      await flushPromises();

      expect(heading(wrapper)).toBe("onboarding.steps.home_assistant.title");
      expect(
        wrapper
          .find("[data-testid=onboarding-home-assistant-connection]")
          .text(),
      ).toBe("Home Assistant");
      expect(
        wrapper
          .find("[data-testid=onboarding-home-assistant-connect]")
          .exists(),
      ).toBe(false);
      expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
        "onboarding.next",
      );
    } finally {
      wrapper.unmount();
    }
  });

  describe("on a fresh server's first run", () => {
    it("opens on an unnumbered welcome, with the account step behind it", async () => {
      const wrapper = await mountFirstRunWizard();
      try {
        await flushPromises();

        expect(heading(wrapper)).toBe("onboarding.steps.get_started.title");
        // the app's own logo in the step's icon
        expect(
          wrapper.find("[data-testid=onboarding-step-icon] img").exists(),
        ).toBe(true);
        expect(wrapper.find("[data-testid=onboarding-back]").exists()).toBe(
          false,
        );
        expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
          "onboarding.steps.get_started.start",
        );
        expect(stepCount(wrapper)).toBeNull();

        await getStarted(wrapper);

        // the logo belongs to the welcome alone
        expect(
          wrapper.find("[data-testid=onboarding-step-icon] img").exists(),
        ).toBe(false);

        expect(wrapper.find("form#form-onboarding-account").exists()).toBe(
          true,
        );
        // the wizard's forward button is the form's submit button
        const submit = wrapper.find("[data-testid=onboarding-next]");
        expect(submit.text()).toBe("onboarding.steps.account.create");
        expect(submit.attributes("type")).toBe("submit");
        expect(submit.attributes("form")).toBe("form-onboarding-account");
        // making the account comes before the setup it opens, so it is not
        // counted as part of it
        expect(stepCount(wrapper)).toBeNull();
        // nothing was asked of a server nobody is signed in to
        expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
        expect(apiMock.getAllUsers).not.toHaveBeenCalled();
        expect(apiMock.subscribe_multi).not.toHaveBeenCalled();
      } finally {
        wrapper.unmount();
      }
    });

    it("goes back from the account step to the welcome", async () => {
      const wrapper = await mountFirstRunWizard();
      try {
        await flushPromises();
        await getStarted(wrapper);

        await wrapper.find("[data-testid=onboarding-back]").trigger("click");
        await flushPromises();

        expect(heading(wrapper)).toBe("onboarding.steps.get_started.title");
      } finally {
        wrapper.unmount();
      }
    });

    it("creates the account through the wizard's forward button", async () => {
      let answerSetup: (response: Response) => void = () => {};
      const fetchMock = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answerSetup = resolve;
          }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const wrapper = await mountFirstRunWizard({ attach: true });
      try {
        await flushPromises();
        await getStarted(wrapper);
        await wrapper.get('input[name="username"]').setValue("admin");
        await wrapper
          .get('input[name="password"]')
          .setValue("correct horse battery");
        await wrapper
          .get('input[name="confirmPassword"]')
          .setValue("correct horse battery");

        const submit = wrapper.find("[data-testid=onboarding-next]");
        await submit.trigger("click");
        await flushPromises();

        expect(fetchMock).toHaveBeenCalledOnce();
        // the account is on its way: the forward button shows it, and Back
        // holds still
        expect(submit.attributes("aria-busy")).toBe("true");
        expect(submit.attributes("disabled")).toBeDefined();
        expect(
          wrapper.find("[data-testid=onboarding-back]").attributes("disabled"),
        ).toBeDefined();

        answerSetup(
          new Response(JSON.stringify({ success: true, token: "token-1" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
        await flushPromises();
        expect(authMock.setToken).toHaveBeenCalledWith("token-1");
        // still busy while the app signs in with it
        expect(submit.attributes("aria-busy")).toBe("true");

        signInAsNewAdmin();
        await flushPromises();
        expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
      } finally {
        wrapper.unmount();
        vi.unstubAllGlobals();
      }
    });

    it("shows no Back to the account step once it is done", async () => {
      const wrapper = await mountFirstRunWizard();
      try {
        await flushPromises();
        await getStarted(wrapper);
        signInAsNewAdmin();
        await flushPromises();

        expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
        expect(wrapper.find("[data-testid=onboarding-back]").exists()).toBe(
          false,
        );

        // the steps after it still go back as far as the first one
        await pickIntent(wrapper, "music_hub");
        expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");
        await wrapper.find("[data-testid=onboarding-back]").trigger("click");
        await flushPromises();
        expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
        expect(wrapper.find("[data-testid=onboarding-back]").exists()).toBe(
          false,
        );
      } finally {
        wrapper.unmount();
      }
    });

    it("loads the setup for the admin once they are signed in, and moves on", async () => {
      addMusicProvider();
      const wrapper = await mountFirstRunWizard();
      await flushPromises();
      await getStarted(wrapper);

      signInAsNewAdmin();
      await flushPromises();

      // the admin is in: what is configured is loaded for them, the players
      // are followed, and the account step is behind them
      expect(apiMock.getProviderConfigs).toHaveBeenCalledOnce();
      expect(apiMock.getAllUsers).toHaveBeenCalledOnce();
      expect(apiMock.subscribe_multi).toHaveBeenCalledOnce();
      expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
      expect(stepCount(wrapper)).toBeNull();

      // the numbered setup starts after the choice, the account not counted
      await pickIntent(wrapper, "music_hub");
      expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");
      expect(stepCount(wrapper)).toBe("1/6");
      await wrapper.find(FORWARD).trigger("click");
      await flushPromises();
      expect(stepCount(wrapper)).toBe("2/6");
      // the music source that is set up counts, now that it can be seen
      const progress = wrapper.findAll(
        "[data-testid=onboarding-progress-step]",
      );
      expect(progress[0].attributes("aria-label")).toBe(
        "onboarding.step_completed",
      );

      wrapper.unmount();
    });

    it("counts only the three existing-app setup screens after creating an account", async () => {
      const wrapper = await mountFirstRunWizard();
      try {
        await flushPromises();
        await getStarted(wrapper);
        signInAsNewAdmin();
        await flushPromises();
        expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
        expect(stepCount(wrapper)).toBeNull();

        await pickIntent(wrapper, "phone_apps");
        expect(heading(wrapper)).toBe("onboarding.steps.players.title");
        expect(stepCount(wrapper)).toBe("1/3");

        for (const [title, count] of [
          ["onboarding.steps.plugins.phone_apps_title", "2/3"],
          ["onboarding.steps.finish.title", "3/3"],
        ]) {
          await wrapper.find(FORWARD).trigger("click");
          await flushPromises();
          expect(heading(wrapper)).toBe(title);
          expect(stepCount(wrapper)).toBe(count);
        }
      } finally {
        wrapper.unmount();
      }
    });

    it("stays on the question when its answer did not land", async () => {
      const wrapper = await mountFirstRunWizard();
      try {
        await flushPromises();
        await getStarted(wrapper);
        signInAsNewAdmin();
        await flushPromises();
        // the write is rolled back, so nothing is on the account
        setUserPreferenceMock.mockResolvedValue(false);

        await pickIntent(wrapper, "music_hub");
        expect(setUserPreferenceMock).toHaveBeenCalledOnce();
        expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
      } finally {
        wrapper.unmount();
      }
    });

    it("moves one step however often a card is clicked", async () => {
      let landIntent: () => void = () => {};
      setUserPreferenceMock.mockImplementationOnce(
        (key: string, value: string) =>
          new Promise<boolean>((resolve) => {
            landIntent = () => {
              if (key === "onboarding.intent")
                preferenceState.intent.value = value;
              resolve(true);
            };
          }),
      );
      const wrapper = await mountFirstRunWizard();
      try {
        await flushPromises();
        await getStarted(wrapper);
        signInAsNewAdmin();
        await flushPromises();

        // an impatient second click, landing before the card can even grey out
        const card = wrapper.find("[data-testid=onboarding-intent-music_hub]");
        void card.trigger("click");
        await card.trigger("click");
        await flushPromises();

        // the answer is still on its way out, and the cards say so
        expect(card.attributes("disabled")).toBeDefined();

        landIntent();
        await flushPromises();

        // one save, and one step: an impatient second click is not a second move
        expect(setUserPreferenceMock).toHaveBeenCalledOnce();
        expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");
      } finally {
        wrapper.unmount();
      }
    });

    it("does not reopen account creation from the first-run recap", async () => {
      let wrapper = await mountFirstRunWizard();
      try {
        await flushPromises();
        await getStarted(wrapper);
        signInAsNewAdmin();
        await flushPromises();
        wrapper.unmount();

        wrapper = await mountWizard({ fresh: false, step: "finish" });
        await flushPromises();
        // the account cannot be undone and comes before everything else, so
        // the recap neither looks back at it nor ever lists it as to do
        expect(wrapper.text()).not.toContain("onboarding.steps.account.title");
        expect(heading(wrapper)).toBe("onboarding.steps.finish.title");
      } finally {
        wrapper.unmount();
      }
    });
  });

  it("shows a loading state until the provider configurations are in", async () => {
    let handOverConfigs: (configs: unknown[]) => void = () => {};
    apiMock.getProviderConfigs.mockImplementation(
      () =>
        new Promise((resolve) => {
          handOverConfigs = resolve;
        }),
    );

    const wrapper = await mountWizard();
    await flushPromises();

    // the wizard is up, but on the spinner: no heading, no footer to flash past
    expect(wrapper.find("[data-testid=onboarding-wizard]").exists()).toBe(true);
    expect(wrapper.find("[data-testid=onboarding-loading]").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-testid=onboarding-heading]").exists()).toBe(
      false,
    );
    expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(false);

    handOverConfigs([]);
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-loading]").exists()).toBe(
      false,
    );
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");

    wrapper.unmount();
  });

  it("shows a step's own action as the main button, with a skip beside it", async () => {
    const wrapper = await mountWizard({ step: "invite_members" });
    await flushPromises();

    const footer = wrapper.find("footer");
    // one main button, and it is the last one
    expect(footer.findAll("button").at(-1)!.attributes("data-testid")).toBe(
      "onboarding-primary-action",
    );
    expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(false);

    const dialog = wrapper.findComponent({ name: "CreateUserDialog" });
    expect(dialog.props("modelValue")).toBe(false);
    await wrapper
      .find("[data-testid=onboarding-primary-action]")
      .trigger("click");
    expect(dialog.props("modelValue")).toBe(true);
    expect(heading(wrapper)).toBe("onboarding.steps.invite_members.title");

    await wrapper.find("[data-testid=onboarding-skip]").trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.finish.title");

    wrapper.unmount();
  });

  it("moves on with Next once the step is set up", async () => {
    addMember("sam-1");

    const wrapper = await mountWizard({ step: "invite_members" });
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
      "onboarding.next",
    );
    expect(wrapper.find("[data-testid=onboarding-skip]").exists()).toBe(false);
    expect(
      wrapper.find("[data-testid=onboarding-primary-action]").exists(),
    ).toBe(false);
    // and the step's icon says it is done
    expect(wrapper.find("[data-testid=onboarding-step-done]").exists()).toBe(
      true,
    );

    wrapper.unmount();
  });

  it("puts the step's lead under its title", async () => {
    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    const lead = wrapper.find("[data-testid=onboarding-lead]");
    expect(lead.text()).toBe("onboarding.steps.intent.intro");
    // the question the cards answer is the lead the cards point to
    expect(wrapper.find("[role=group]").attributes("aria-labelledby")).toBe(
      lead.attributes("id"),
    );
    expect(
      wrapper.find("[data-testid=onboarding-intent-reassurance]").text(),
    ).toBe("onboarding.steps.intent.reassurance");

    wrapper.unmount();
  });

  it("recaps what is still to do before the optional extras", async () => {
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard({ step: "finish" });
    await flushPromises();

    const rows = wrapper
      .findAll("[data-testid^=onboarding-summary-]")
      .map((row) => row.attributes("data-testid"));
    const lastPending = rows.lastIndexOf("onboarding-summary-pending");
    const firstOptional = rows.indexOf("onboarding-summary-optional");
    expect(lastPending).toBeGreaterThanOrEqual(0);
    expect(firstOptional).toBeGreaterThan(lastPending);
    expect(wrapper.text()).toContain("onboarding.still_to_do");

    wrapper.unmount();
  });

  it("follows a deep link and offers to skip an optional step", async () => {
    const wrapper = await mountWizard({ step: "invite_members" });
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.invite_members.title");
    expect(wrapper.find("[data-testid=onboarding-primary-action]").text()).toBe(
      "onboarding.add_member",
    );
    expect(wrapper.find("[data-testid=onboarding-skip]").text()).toBe(
      "onboarding.skip",
    );

    wrapper.unmount();
  });

  it("resumes a removed setup step on the next relevant existing-app step", async () => {
    preferenceState.intent.value = "phone_apps";

    const wrapper = await mountWizard({ step: "music_sources" });
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.players.title");
    // nothing set up yet: adding player support is the way on, or a skip
    expect(wrapper.find("[data-testid=onboarding-primary-action]").text()).toBe(
      "settings.add_player_provider",
    );

    wrapper.unmount();
  });

  it("preselects nothing, and only badges the recommended music hub", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    const musicHub = wrapper.find("[data-testid=onboarding-intent-music_hub]");
    const phoneApps = wrapper.find(
      "[data-testid=onboarding-intent-phone_apps]",
    );

    // the question is the user's to answer: no card reads as chosen, and the
    // cards are the only way on
    expect(musicHub.attributes("aria-pressed")).toBe("false");
    expect(phoneApps.attributes("aria-pressed")).toBe("false");
    expect(musicHub.text()).toContain("recommended");
    expect(phoneApps.text()).not.toContain("recommended");
    expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(false);
    expect(setUserPreferenceMock).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("answers the intent question and moves on with the card that was picked", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    await pickIntent(wrapper, "music_hub");

    // the answer is persisted, so a second run starts past the question
    expect(setUserPreferenceMock).toHaveBeenCalledOnce();
    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "music_hub",
    );
    // and it moves exactly one step, onto the music sources
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");

    wrapper.unmount();
  });

  it("keeps the cards inert while the picked intent is on its way", async () => {
    let landIntent: () => void = () => {};
    setUserPreferenceMock.mockImplementationOnce(
      (key: string, value: string) =>
        new Promise<boolean>((resolve) => {
          landIntent = () => {
            if (key === "onboarding.intent")
              preferenceState.intent.value = value;
            resolve(true);
          };
        }),
    );

    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper
      .find("[data-testid=onboarding-intent-phone_apps]")
      .trigger("click");
    await flushPromises();

    // a second card clicked now would land behind the first answer, on a
    // wizard that has already moved on, so none can be while it is on its way
    expect(
      wrapper
        .find("[data-testid=onboarding-intent-music_hub]")
        .attributes("disabled"),
    ).toBeDefined();
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");

    landIntent();
    await flushPromises();
    // existing-app setup starts with the players
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    wrapper.unmount();
  });

  it("stays on the intent question when the answer did not land", async () => {
    // the write is rolled back, so nothing is on the account
    setUserPreferenceMock.mockResolvedValue(false);

    const wrapper = await mountWizard();
    await flushPromises();

    await pickIntent(wrapper, "phone_apps");

    // the api has told the user; walking on would leave the question behind
    // with no answer on the account
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");

    // the card is there to try again with, and it does not land either
    await pickIntent(wrapper, "phone_apps");
    expect(setUserPreferenceMock).toHaveBeenCalledTimes(2);
    expect(setUserPreferenceMock).toHaveBeenLastCalledWith(
      "onboarding.intent",
      "phone_apps",
    );
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");

    wrapper.unmount();
  });

  it("shows the stored intent again when a change of it did not land", async () => {
    preferenceState.intent.value = "music_hub";
    // the account does not take the new answer, so the old one stays on it
    setUserPreferenceMock.mockResolvedValueOnce(false);

    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    await pickIntent(wrapper, "phone_apps");

    // the wizard stays on the question, which shows the answer the account holds
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
    expect(
      wrapper
        .find("[data-testid=onboarding-intent-music_hub]")
        .attributes("aria-pressed"),
    ).toBe("true");
    expect(
      wrapper
        .find("[data-testid=onboarding-intent-phone_apps]")
        .attributes("aria-pressed"),
    ).toBe("false");

    // picking it again tries it again; existing-app setup starts with the players
    await pickIntent(wrapper, "phone_apps");
    expect(setUserPreferenceMock).toHaveBeenLastCalledWith(
      "onboarding.intent",
      "phone_apps",
    );
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    wrapper.unmount();
  });

  it("shows the answer given when coming back, and waits for a pick", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    await pickIntent(wrapper, "phone_apps");
    // existing-app setup starts with the players
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    await wrapper.find("[data-testid=onboarding-back]").trigger("click");
    await flushPromises();

    // back on the question, the answer given reads as chosen, and the wizard
    // stays there until a card is picked: going back answers nothing
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
    expect(
      wrapper
        .find("[data-testid=onboarding-intent-phone_apps]")
        .attributes("aria-pressed"),
    ).toBe("true");
    expect(setUserPreferenceMock).toHaveBeenCalledOnce();

    await pickIntent(wrapper, "phone_apps");
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    wrapper.unmount();
  });

  it("moves exactly one step even when the next step is already done", async () => {
    // both the music sources and the players were set up before the wizard
    // opened, so both of those steps are already done
    addMusicProvider();
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    await pickIntent(wrapper, "music_hub");

    // one step on from the intent is the music sources: a done step is walked
    // through, not jumped over, so the wizard does not land on the review
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");

    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();

    // and one more step is the players, still one at a time
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    wrapper.unmount();
  });

  it("jumps back to an earlier step from the progress list", async () => {
    // a music source so the step is completed, and thus a jump target
    addMusicProvider();

    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    // walk a couple of steps along: intent -> music sources -> players
    await pickIntent(wrapper, "music_hub");
    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    const steps = wrapper.findAll("[data-testid=onboarding-progress-step]");
    // the completed steps behind the current one are the way back; the current
    // one and everything still ahead is not
    expect(steps[0].attributes("disabled")).toBeUndefined();
    expect(steps[1].attributes("disabled")).toBeDefined();
    expect(steps[2].attributes("disabled")).toBeDefined();

    await steps[0].trigger("click");
    await flushPromises();

    // clicking one behind takes the wizard back to it
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");
    expect(stepCount(wrapper)).toBe("1/6");

    wrapper.unmount();
  });

  it("goes back one step at a time", async () => {
    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    await pickIntent(wrapper, "music_hub");
    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    await wrapper.find("[data-testid=onboarding-back]").trigger("click");
    await flushPromises();

    // back lands on the step right before, not wherever the wizard started
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");

    // and back from the first counted step is the setup choice again
    await wrapper.find("[data-testid=onboarding-back]").trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
    expect(stepCount(wrapper)).toBeNull();

    wrapper.unmount();
  });

  it("keeps the setup choice out of the numbered setup, whatever is chosen", async () => {
    preferenceState.intent.value = "music_hub";
    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    // reopened with an answer saved, still unnumbered
    expect(stepCount(wrapper)).toBeNull();

    // each pick starts its own numbered setup, and the choice is never in it
    for (const [intent, title, count] of [
      ["phone_apps", "onboarding.steps.players.title", "1/3"],
      ["music_hub", "onboarding.steps.music_sources.title", "1/6"],
    ]) {
      await pickIntent(wrapper, intent);
      expect(heading(wrapper)).toBe(title);
      expect(stepCount(wrapper)).toBe(count);

      await wrapper.find("[data-testid=onboarding-back]").trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
      expect(stepCount(wrapper)).toBeNull();
    }
    wrapper.unmount();
  });

  it("counts the summary as the last step of the full setup", async () => {
    const wrapper = await mountWizard({ step: "finish" });
    await flushPromises();

    expect(stepCount(wrapper)).toBe("6/6");

    wrapper.unmount();
  });

  it("lists what is set up and what is left on the summary", async () => {
    addMusicProvider();

    const wrapper = await mountWizard({ step: "finish" });
    await flushPromises();

    expect(
      wrapper.findAll("[data-testid=onboarding-summary-done]"),
    ).toHaveLength(1);
    expect(
      wrapper.findAll("[data-testid=onboarding-summary-pending]"),
    ).toHaveLength(2);
    expect(
      wrapper.findAll("[data-testid=onboarding-summary-optional]"),
    ).toHaveLength(2);
    // the server settings are only there to be looked over, so they are on
    // neither list: nothing about them is set up or still to do
    expect(wrapper.text()).not.toContain("onboarding.steps.core_settings");
    expect(wrapper.find("[data-testid=onboarding-finish]").exists()).toBe(true);
    // the summary's footer offers Finish instead of Next
    expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(false);

    // the whole row of a step still to do is the way back to it
    const pending = wrapper.find("[data-testid=onboarding-summary-pending]");
    expect(pending.element.tagName).toBe("BUTTON");
    await pending.trigger("click");
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");

    wrapper.unmount();
  });

  it.each(["music_hub", "phone_apps"])(
    "revisits every completed setup row, including the choice, for %s",
    async (intent) => {
      preferenceState.intent.value = intent;
      addEveryProvider();
      addAudioSourcePlugin("connect--1", "spotify_connect");
      addMember("alex");
      const targets =
        intent === "phone_apps"
          ? ["intent", "players", "plugins"]
          : ["intent", "music_sources", "players", "ai", "invite_members"];

      for (const id of targets) {
        const wrapper = await mountWizard({ step: "finish" });
        try {
          await flushPromises();
          const title =
            id === "intent"
              ? "onboarding.steps.intent.summary_title"
              : id === "plugins" && intent === "phone_apps"
                ? "onboarding.steps.plugins.phone_apps_title"
                : id === "ai"
                  ? "onboarding.steps.ai.enrich_title"
                  : `onboarding.steps.${id}.title`;
          const row = wrapper
            .findAll("[data-testid=onboarding-summary-done]")
            .find((item) => item.text().includes(title));
          expect(row).toBeDefined();
          expect(row!.element.tagName).toBe("BUTTON");
          await row!.trigger("click");
          await flushPromises();
          expect(heading(wrapper)).toBe(
            id === "intent" ? "onboarding.steps.intent.title" : title,
          );
          if (id === "intent") expect(stepCount(wrapper)).toBeNull();
        } finally {
          wrapper.unmount();
        }
      }
    },
  );

  it("offers the tour on the summary and starts it once onboarding has closed", async () => {
    addMusicProvider();

    const wrapper = await mountWizard({ step: "finish" });
    await flushPromises();
    expect(wrapper.find("footer [data-testid=onboarding-tour]").exists()).toBe(
      true,
    );

    await wrapper.find("[data-testid=onboarding-tour]").trigger("click");
    await flushPromises();

    // taking the tour is a way out of the wizard too: the server is told the
    // setup is done, and the tour follows on from that
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      "config/onboard_complete",
      undefined,
      { suppressGlobalError: true },
    );
    expect(startTourMock).toHaveBeenCalledTimes(1);
    expect(startTourMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      apiMock.sendCommand.mock.invocationCallOrder[0],
    );

    wrapper.unmount();
  });

  it("holds both finish actions and recap navigation while finishing", async () => {
    preferenceState.intent.value = "music_hub";
    let landFinish: () => void = () => {};
    apiMock.sendCommand.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          landFinish = resolve;
        }),
    );
    const wrapper = await mountWizard({ step: "finish" });
    try {
      await flushPromises();
      await wrapper
        .find("footer [data-testid=onboarding-tour]")
        .trigger("click");
      await flushPromises();

      for (const control of wrapper.findAll(
        "footer button, [data-testid=onboarding-summary-done], [data-testid=onboarding-summary-pending], [data-testid=onboarding-summary-optional]",
      )) {
        expect(control.attributes("disabled")).toBeDefined();
      }
      const choice = wrapper.find("[data-testid=onboarding-summary-done]");
      await choice.trigger("click");
      expect(heading(wrapper)).toBe("onboarding.steps.finish.title");
      expect(startTourMock).not.toHaveBeenCalled();

      landFinish();
      await flushPromises();
      expect(apiMock.sendCommand).toHaveBeenCalledOnce();
      expect(startTourMock).toHaveBeenCalledOnce();
    } finally {
      landFinish();
      wrapper.unmount();
    }
  });

  it("holds the tour back when onboarding could not be closed", async () => {
    addMusicProvider();
    apiMock.sendCommand.mockRejectedValueOnce(new Error("server away"));

    const wrapper = await mountWizard({ step: "finish" });
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-tour]").trigger("click");
    await flushPromises();

    // the wizard stays up with its error, and the tour waits with it
    expect(startTourMock).not.toHaveBeenCalled();
    expect(heading(wrapper)).toBe("onboarding.steps.finish.title");

    wrapper.unmount();
  });

  it("finishes without the tour from the plain finish", async () => {
    addMusicProvider();

    const wrapper = await mountWizard({ step: "finish" });
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-finish]").trigger("click");
    await flushPromises();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    expect(startTourMock).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("falls back to the first step still to do for a step it does not know", async () => {
    const wrapper = await mountWizard({ step: "nope" as OnboardingStepId });
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");

    wrapper.unmount();
  });

  it("stays on the step a provider turns up on", async () => {
    const wrapper = await mountWizard({ step: "music_sources" });
    await flushPromises();

    addMusicProvider();
    await reportProvidersUpdated();

    // the step is page state: ticking it off must not move the wizard on
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");
    expect(
      wrapper.findAll("[data-testid=onboarding-configured-provider]"),
    ).toHaveLength(1);

    wrapper.unmount();
  });

  it("lists the players the server already found", async () => {
    apiMock.getPlayerConfigs.mockResolvedValue([
      playerConfig({ player_id: "kitchen", default_name: "Kitchen speaker" }),
    ]);
    apiMock.providerManifests["chromecast"] = {
      builtin: false,
      name: "Chromecast",
    };

    const wrapper = await mountWizard({ step: "players" });
    await flushPromises();

    const players = wrapper.findAll("[data-testid=onboarding-player]");
    expect(players).toHaveLength(1);
    expect(players[0].text()).toContain("Kitchen speaker");
    expect(players[0].text()).toContain("Chromecast");

    wrapper.unmount();
  });

  it("follows the players for as long as it is open", async () => {
    const stopFollowing = vi.fn();
    apiMock.subscribe_multi.mockReturnValue(stopFollowing);

    const wrapper = await mountWizard({ step: "players" });
    await flushPromises();

    // the players keep turning up while the setup runs, so they are followed
    // from before the load until the wizard is gone
    expect(apiMock.subscribe_multi).toHaveBeenCalledOnce();
    expect(apiMock.subscribe_multi.mock.calls[0][0]).toEqual([
      EventType.PLAYER_CONFIG_UPDATED,
      EventType.PLAYER_ADDED,
      EventType.PLAYER_REMOVED,
    ]);
    expect(stopFollowing).not.toHaveBeenCalled();

    wrapper.unmount();

    expect(stopFollowing).toHaveBeenCalledOnce();
  });

  it("walks past the remote access step on its way to the summary", async () => {
    addEveryProvider();
    addMember("sam-1");
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard({ step: "core_settings" });
    await flushPromises();

    // a review is nothing to tick off, so it is shown rather than skipped;
    // turning remote access on is its main action, with a skip beside it
    expect(heading(wrapper)).toBe("onboarding.steps.core_settings.away_title");
    expect(wrapper.find("[data-testid=onboarding-primary-action]").text()).toBe(
      "onboarding.steps.core_settings.remote.turn_on",
    );
    expect(wrapper.find("[data-testid=onboarding-skip]").text()).toBe(
      "onboarding.skip",
    );

    // the AI and the household are done, but a done step is still walked
    // through
    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.ai.enrich_title");

    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.invite_members.title");

    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.finish.title");

    wrapper.unmount();
  });

  it("moves on from the players to the server settings", async () => {
    addMusicProvider();
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard({ step: "players" });
    await flushPromises();

    await wrapper.find(FORWARD).trigger("click");
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.core_settings.away_title");

    wrapper.unmount();
  });

  it("offers to skip the household, which is optional", async () => {
    addEveryProvider();
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard();
    await flushPromises();

    // the only thing left to do is the one thing the wizard never insists on
    expect(heading(wrapper)).toBe("onboarding.steps.invite_members.title");
    expect(wrapper.find("[data-testid=onboarding-primary-action]").text()).toBe(
      "onboarding.add_member",
    );
    expect(wrapper.find("[data-testid=onboarding-skip]").text()).toBe(
      "onboarding.skip",
    );

    wrapper.unmount();
  });

  it("never opens on the server settings by itself", async () => {
    addEveryProvider();
    addMember("sam-1");
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard();
    await flushPromises();

    // nothing is left to do, and a review is not something to be dropped in
    expect(heading(wrapper)).toBe("onboarding.steps.finish.title");

    wrapper.unmount();
  });

  it("follows a deep link to the remote access step", async () => {
    const wrapper = await mountWizard({ step: "core_settings" });
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.core_settings.away_title");
    expect(wrapper.find("[data-testid=onboarding-primary-action]").text()).toBe(
      "onboarding.steps.core_settings.remote.turn_on",
    );

    wrapper.unmount();
  });

  describe("the member's welcome", () => {
    beforeEach(() => {
      signInAsMember();
    });

    it("lists adding personal sources as an optional invitation", async () => {
      signInAsMember(BUILTIN_ROLE_SCOPES.user);
      preferenceState.expertMode.value = false;
      const wrapper = await mountWizard({ step: "all_set" });
      await flushPromises();

      expect(
        wrapper.find("[data-testid=onboarding-summary-pending]").exists(),
      ).toBe(false);
      const invitation = wrapper.find(
        "[data-testid=onboarding-summary-optional]",
      );
      expect(invitation.text()).toContain("onboarding.steps.own_sources.title");
      await invitation.trigger("click");
      expect(heading(wrapper)).toBe("onboarding.steps.own_sources.title");
      expect(wrapper.find("[data-testid=onboarding-skip]").text()).toBe(
        "onboarding.skip",
      );
      wrapper.unmount();
    });

    it("opens on the welcome and says which wizard this is", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      expect(heading(wrapper)).toBe("onboarding.steps.welcome.title");
      // the step's title says it all: there is no eyebrow above it
      expect(wrapper.text()).not.toContain("onboarding.welcome_title");
      expect(wrapper.text()).not.toContain("onboarding.title");

      wrapper.unmount();
    });

    it("renders the own-sources step for a member who can add sources", async () => {
      signInAsMember(BUILTIN_ROLE_SCOPES.user);

      const wrapper = await mountWizard({ step: "own_sources" });
      await flushPromises();

      expect(heading(wrapper)).toBe("onboarding.steps.own_sources.title");
      // adding a source is the step's main action, in the wizard's footer
      expect(
        wrapper.find("[data-testid=onboarding-primary-action]").text(),
      ).toBe("onboarding.steps.own_sources.add");

      wrapper.unmount();
    });

    it("walks the member from the question to the way out", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      expect(heading(wrapper)).toBe("onboarding.steps.welcome.title");
      // the welcome has nothing before it, so it is counted from its question,
      // and its cards are the way on
      expect(stepCount(wrapper)).toBe("1/4");
      expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(
        false,
      );
      await pickExperience(wrapper, "expert");

      // the players, then the music, one short step at a time
      expect(heading(wrapper)).toBe("onboarding.steps.your_players.title");
      expect(stepCount(wrapper)).toBe("2/4");
      expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
        "onboarding.next",
      );

      await wrapper.find(FORWARD).trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.your_music.title");

      await wrapper.find(FORWARD).trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.all_set.title");
      expect(stepCount(wrapper)).toBe("4/4");

      // the summary looks back at the one thing the welcome asked, and the
      // answer they gave is the only one written
      expect(wrapper.text()).toContain("onboarding.steps.welcome.expert.label");
      expect(expertAnswers()).toEqual([true]);
      expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(
        false,
      );

      await wrapper.find("[data-testid=onboarding-finish]").trigger("click");
      await flushPromises();

      // the welcome completes nothing on the server; it simply closes and hands
      // the member the app it was showing them, without the tour they passed on
      expect(apiMock.sendCommand).not.toHaveBeenCalled();
      expect(startTourMock).not.toHaveBeenCalled();

      wrapper.unmount();
    });

    it("starts the tour from the summary once the welcome has closed", async () => {
      preferenceState.expertMode.value = false;
      preferenceState.intent.value = "phone_apps";

      const wrapper = await mountWizard();
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.all_set.title");

      await wrapper.find("[data-testid=onboarding-tour]").trigger("click");
      await flushPromises();

      // the marker goes on the account first, and only a welcome that closed
      // hands over to the tour
      expect(setUserPreferencesMock).toHaveBeenCalledWith(
        expect.objectContaining({ "onboarding.welcome": expect.any(String) }),
        { suppressGlobalError: true },
      );
      expect(startTourMock).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it("keeps the cards inert while the welcome answer is saving", async () => {
      // hold the welcome answer mid-flight so the chosen card stays busy; the
      // real write has the answer on the account by the time it says it landed
      let landAnswer: () => void = () => {};
      setUserPreferencesMock.mockImplementationOnce(
        (values: Record<string, boolean>) =>
          new Promise<boolean>((resolve) => {
            landAnswer = () => {
              preferenceState.expertMode.value = values["expert_mode"];
              resolve(true);
            };
          }),
      );

      const wrapper = await mountWizard();
      await flushPromises();

      await wrapper
        .find("[data-testid=onboarding-experience-expert]")
        .trigger("click");
      await flushPromises();

      // a second card clicked while the answer is saving would land behind it,
      // so none can be, and the member stays on the question until it lands
      expect(
        wrapper
          .find("[data-testid=onboarding-experience-standard]")
          .attributes("disabled"),
      ).toBeDefined();
      expect(heading(wrapper)).toBe("onboarding.steps.welcome.title");

      // once it lands, the member moves on one step
      landAnswer();
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.your_players.title");
      expect(expertAnswers()).toEqual([true]);

      wrapper.unmount();
    });

    it("opens on the summary once the member has answered", async () => {
      preferenceState.expertMode.value = false;

      const wrapper = await mountWizard();
      await flushPromises();

      // nothing left to ask, and the setup's summary is not theirs to land on
      expect(heading(wrapper)).toBe("onboarding.steps.all_set.title");

      wrapper.unmount();
    });

    it("looks back at the answer a member did give", async () => {
      preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";
      preferenceState.expertMode.value = false;

      const wrapper = await mountWizard();
      await flushPromises();

      const done = wrapper.findAll("[data-testid=onboarding-summary-done]");
      expect(done).toHaveLength(1);
      expect(done[0].text()).toContain("onboarding.steps.welcome.title");
      expect(done[0].text()).toContain(
        "onboarding.steps.welcome.standard.label",
      );

      wrapper.unmount();
    });

    it("marks a member as welcomed when the wizard closes", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      wrapper.unmount();
      await flushPromises();

      // leaving the welcome behind is what counts as having been welcomed
      const marked = setUserPreferencesMock.mock.calls.some(
        ([values]) => "onboarding.welcome" in values,
      );
      expect(marked).toBe(true);
    });

    it("does not mark a member who was already welcomed", async () => {
      preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";

      const wrapper = await mountWizard();
      await flushPromises();

      wrapper.unmount();
      await flushPromises();

      // the marker says the welcome has been shown, not when it was last opened
      const marked = setUserPreferencesMock.mock.calls.some(
        ([values]) => "onboarding.welcome" in values,
      );
      expect(marked).toBe(false);
    });

    it("asks for nothing a member who cannot own sources decides from", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      // the welcome reads the running players and providers, neither of which it
      // has to fetch, so it waits on nothing
      expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
      expect(apiMock.getAllUsers).not.toHaveBeenCalled();

      wrapper.unmount();
    });

    it("follows no players on behalf of a member", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      // the players are the admin's to set up, and a session that is done
      // onboarding has no business fetching a configuration for every one
      expect(apiMock.getPlayerConfigs).not.toHaveBeenCalled();
      expect(apiMock.subscribe_multi).not.toHaveBeenCalled();

      wrapper.unmount();
    });

    it("loads the provider configurations for a member who can own sources", async () => {
      signInAsMember(BUILTIN_ROLE_SCOPES.user);

      const wrapper = await mountWizard();
      await flushPromises();

      // the own-sources step needs the configs to tell which sources they own
      expect(apiMock.getProviderConfigs).toHaveBeenCalled();
      expect(apiMock.getAllUsers).not.toHaveBeenCalled();

      wrapper.unmount();
    });
  });
});
