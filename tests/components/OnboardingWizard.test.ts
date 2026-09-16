import {
  ConfigEntryType,
  ProviderType,
  UserRole,
  type Scope,
  type User,
} from "@/plugins/api/interfaces";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { flushPromises, mount } from "@vue/test-utils";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  BUILTIN_ROLE_SCOPES,
  MEMBER_WITHOUT_OWN_SCOPES,
  scopeChecker,
} from "../fixtures/scopes";
import { user } from "../fixtures/user";

const {
  apiMock,
  authMock,
  coreForm,
  preferenceState,
  providerConfigs,
  routerMock,
  routeState,
  setUserPreferenceMock,
  setUserPreferencesMock,
  storeState,
  users,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providers: {} as Record<string, { name: string }>,
    providerManifests: {} as Record<string, { builtin: boolean }>,
    getAllUsers: vi.fn(),
    configureRemoteAccess: vi.fn(),
    getCoreConfig: vi.fn(),
    getProviderConfigs: vi.fn(),
    getRemoteAccessInfo: vi.fn(),
    getStreamServerInfo: vi.fn(),
    saveCoreConfig: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: {
      value: {
        onboard_done: false,
        server_id: "server-1",
        internal_url: "http://192.168.1.10:8095",
        has_remote_access: false,
      },
    },
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  // the settings form as the server settings step drives it: what it is holding
  // on to when it comes up, whether those values validate, and what the user
  // typed, as the form hands it over
  coreForm: {
    hasUnsavedChanges: false,
    valuesValidate: true,
    values: { server_name: "Living room" },
  },
  // replaced with real refs by the userPreferences mock factory below
  preferenceState: {
    intent: { value: undefined } as { value?: string },
    persona: { value: undefined } as { value?: string },
    welcomedAt: { value: undefined } as { value?: string },
    ready: false,
  },
  // what the server hands back as the provider configurations
  providerConfigs: { list: [] as Record<string, unknown>[] },
  // replaced with a reactive route by the vue-router mock factory below; the
  // wizard no longer reads it, but the tour and what's-here steps use the router
  routeState: { route: { query: {} as Record<string, string> }, ready: false },
  routerMock: { push: vi.fn(), replace: vi.fn() },
  setUserPreferenceMock: vi.fn(),
  setUserPreferencesMock: vi.fn(),
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

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("vue-router", async () => {
  // the wizard does not sync the route, but the tour and what's-here steps ask
  // for the router; every test loads a fresh wizard, which runs this factory
  // again, so hand out the same route
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  if (!routeState.ready) {
    routeState.route = reactive({ query: {} as Record<string, string> });
    routeState.ready = true;
  }
  return { useRoute: () => routeState.route, useRouter: () => routerMock };
});

// the dialogs and the config form are covered where they live; here they only
// have to be reachable
vi.mock("@/views/settings/AddProviderDialog.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/users/CreateUserDialog.vue", () => ({
  default: { props: ["modelValue"], template: "<div />" },
}));

vi.mock("@/views/settings/EditConfig.vue", () => ({
  default: {
    props: ["configEntries", "disabled", "showAdvancedSettings"],
    emits: ["submit"],
    setup(
      _props: unknown,
      {
        emit,
      }: { emit: (event: "submit", values: Record<string, string>) => void },
    ) {
      return {
        hasUnsavedChanges: coreForm.hasUnsavedChanges,
        saveFailed: () => {},
        saveSucceeded: () => {},
        submit: async () => {
          if (coreForm.valuesValidate) emit("submit", coreForm.values);
        },
      };
    },
    template: "<div data-testid='onboarding-core-config' />",
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
    preferenceState.persona = ref<string | undefined>(undefined);
    preferenceState.welcomedAt = ref<string | undefined>(undefined);
    preferenceState.ready = true;
  }
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

// The wizard pulls its whole step graph in behind it: the provider listings,
// the welcome's cards, the players of what is here and the tour. Every test
// mounts it on a fresh module registry, so the transform of all that is paid
// here, once and outside any test's clock, instead of by whichever test happens
// to mount first.
beforeAll(async () => {
  await import("@/components/onboarding/OnboardingWizard.vue");
});

/**
 * A fresh wizard per test: the onboarding state lives for a whole session.
 * `step` sets the composable's requested step, which the wizard opens on the
 * same way a deep link does; `fresh: false` reopens on the state a first visit
 * left behind.
 */
async function mountWizard({
  fresh = true,
  step,
}: { fresh?: boolean; step?: OnboardingStepId } = {}) {
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

function addMusicProvider() {
  addProvider("spotify--1", "spotify", ProviderType.MUSIC, "Spotify");
}

/** Everything the wizard asks for bar the household. */
function addEveryProvider() {
  addMusicProvider();
  addProvider("sonos--1", "sonos", ProviderType.PLAYER);
  addProvider("party--1", "party", ProviderType.PLUGIN);
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

function heading(wrapper: Awaited<ReturnType<typeof mountWizard>>) {
  return wrapper.find("[data-testid=onboarding-heading]").text();
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

// every test mounts the wizard on a fresh module registry, which is its whole
// step graph evaluated again and can take seconds under load
// hand the network guard back after every test
afterEach(() => {
  vi.unstubAllGlobals();
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
    apiMock.getAllUsers.mockReset();
    apiMock.getAllUsers.mockImplementation(async () => [...users.list]);
    apiMock.getCoreConfig.mockReset();
    apiMock.getCoreConfig.mockResolvedValue({
      domain: "webserver",
      last_error: null,
      values: {
        server_name: {
          category: "generic",
          default_value: null,
          key: "server_name",
          label: "Server name",
          options: [],
          required: false,
          type: ConfigEntryType.STRING,
          value: "Music Assistant",
        },
      },
    });
    apiMock.saveCoreConfig.mockReset();
    apiMock.saveCoreConfig.mockResolvedValue(undefined);
    apiMock.getStreamServerInfo.mockReset();
    apiMock.getStreamServerInfo.mockResolvedValue({
      base_url: "http://192.168.1.10:8097",
    });
    apiMock.getRemoteAccessInfo.mockReset();
    apiMock.configureRemoteAccess.mockReset();
    // the server settings step probes the addresses from the browser
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ server_id: "server-1" }), {
            status: 200,
          }),
      ),
    );
    apiMock.sendCommand.mockReset();
    apiMock.subscribe.mockClear();
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    storeState.store.currentUser = user({
      user_id: "admin-1",
      username: "admin",
      role: UserRole.ADMIN,
    });
    coreForm.hasUnsavedChanges = false;
    coreForm.valuesValidate = true;
    preferenceState.intent.value = undefined;
    preferenceState.persona.value = undefined;
    preferenceState.welcomedAt.value = undefined;
    routerMock.push.mockReset();
    routerMock.replace.mockReset();
    setUserPreferenceMock.mockReset();
    setUserPreferencesMock.mockReset();
    // the real ones update the preferences before they ever reach the server
    setUserPreferenceMock.mockImplementation(
      async (key: string, value: string) => {
        if (key === "onboarding.intent") preferenceState.intent.value = value;
      },
    );
    setUserPreferencesMock.mockImplementation(
      async (values: Record<string, string>) => {
        const answer = values["onboarding.persona"];
        if (answer) preferenceState.persona.value = answer;
        const welcomed = values["onboarding.welcome"];
        if (welcomed) preferenceState.welcomedAt.value = welcomed;
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

  it("follows a deep link and offers to skip an optional step", async () => {
    const wrapper = await mountWizard({ step: "plugins" });
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.plugins.title");
    expect(wrapper.find("[data-testid=onboarding-add-provider]").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
      "onboarding.skip",
    );

    wrapper.unmount();
  });

  it("offers to skip the music sources once they are deferred", async () => {
    preferenceState.intent.value = "phone_apps";

    const wrapper = await mountWizard({ step: "music_sources" });
    await flushPromises();

    // deferred is not optional, but it is not something to hold the wizard up
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");
    expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
      "onboarding.skip",
    );

    wrapper.unmount();
  });

  it("preselects the recommended music hub before the user picks", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    const musicHub = wrapper.find("[data-testid=onboarding-intent-music_hub]");
    const phoneApps = wrapper.find(
      "[data-testid=onboarding-intent-phone_apps]",
    );

    // the recommended option reads as chosen, and is the only one badged, while
    // nothing is committed until the user acts
    expect(musicHub.attributes("aria-pressed")).toBe("true");
    expect(phoneApps.attributes("aria-pressed")).toBe("false");
    expect(musicHub.text()).toContain("recommended");
    expect(phoneApps.text()).not.toContain("recommended");
    expect(setUserPreferenceMock).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("answers the intent question with the music hub when it is waved through", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    // the default answer is persisted, so a second run starts past the question
    expect(setUserPreferenceMock).toHaveBeenCalledOnce();
    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "music_hub",
    );
    // and it moves exactly one step, onto the music sources
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");

    wrapper.unmount();
  });

  it("leaves an answer the user gave alone", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper
      .find("[data-testid=onboarding-intent-phone_apps]")
      .trigger("click");
    await flushPromises();

    // the answer stands, and the default never lands on top of it; the music
    // sources are deferred behind the plugins, so one step on is the players
    expect(setUserPreferenceMock).toHaveBeenCalledOnce();
    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "phone_apps",
    );
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

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    // one step on from the intent is the music sources: a done step is walked
    // through, not jumped over, so the wizard does not land on the review
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    // and one more step is the players, still one at a time
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    wrapper.unmount();
  });

  it("moves one step on when a choice on the step is made", async () => {
    // the music sources are already set up, so the step after the intent is done
    addMusicProvider();

    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    // choosing on the intent step advances it, and must not jump ahead over the
    // done step behind it
    await wrapper
      .find("[data-testid=onboarding-intent-music_hub]")
      .trigger("click");
    await flushPromises();

    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "music_hub",
    );
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");

    wrapper.unmount();
  });

  it("keeps Next from advancing while a choice is being saved", async () => {
    // hold the answer mid-flight so the chosen card stays busy
    let landIntent: () => void = () => {};
    setUserPreferenceMock.mockImplementationOnce(
      (key: string, value: string) =>
        new Promise<void>((resolve) => {
          landIntent = () => {
            if (key === "onboarding.intent")
              preferenceState.intent.value = value;
            resolve();
          };
        }),
    );

    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    await wrapper
      .find("[data-testid=onboarding-intent-phone_apps]")
      .trigger("click");
    await flushPromises();

    // a Next while the choice is saving neither advances nor waves the default in
    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");
    expect(setUserPreferenceMock).not.toHaveBeenCalledWith(
      "onboarding.intent",
      "music_hub",
    );

    // once the answer lands, the choice moves on one step, with the value it chose
    landIntent();
    await flushPromises();
    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "phone_apps",
    );
    // phone_apps defers the music sources, so one step on is the players
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    wrapper.unmount();
  });

  it("jumps back to an earlier step from the progress list", async () => {
    // a music source so the step is completed, and thus a jump target
    addMusicProvider();

    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    // walk a couple of steps along: intent -> music sources -> players
    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();
    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    const steps = wrapper.findAll("[data-testid=onboarding-progress-step]");
    // the completed steps behind the current one are the way back; the current
    // one and everything still ahead is not
    expect(steps[0].attributes("disabled")).toBeUndefined();
    expect(steps[1].attributes("disabled")).toBeUndefined();
    expect(steps[2].attributes("disabled")).toBeDefined();
    expect(steps[3].attributes("disabled")).toBeDefined();

    await steps[0].trigger("click");
    await flushPromises();

    // clicking one behind takes the wizard back to it
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");

    wrapper.unmount();
  });

  it("goes back one step at a time", async () => {
    const wrapper = await mountWizard({ step: "intent" });
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();
    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.players.title");

    await wrapper.find("[data-testid=onboarding-back]").trigger("click");
    await flushPromises();

    // back lands on the step right before, not wherever the wizard started
    expect(heading(wrapper)).toBe("onboarding.steps.music_sources.title");

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
    ).toHaveLength(4);
    // the server settings are only there to be looked over, so they are on
    // neither list: nothing about them is set up or still to do
    expect(wrapper.text()).not.toContain("onboarding.steps.core_settings");
    expect(wrapper.find("[data-testid=onboarding-finish]").exists()).toBe(true);
    // the summary carries its own finish button instead of the step footer
    expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(false);

    // the whole row of a step still to do is the way back to it
    const pending = wrapper.find("[data-testid=onboarding-summary-pending]");
    expect(pending.element.tagName).toBe("BUTTON");
    await pending.trigger("click");
    expect(heading(wrapper)).toBe("onboarding.steps.intent.title");

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

  it("walks past the server settings on its way to the summary", async () => {
    addEveryProvider();
    addMember("sam-1");
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard({ step: "core_settings" });
    await flushPromises();

    // a review is nothing to set up, so it is shown rather than skipped, and
    // moving on from it is all the footer offers
    expect(heading(wrapper)).toBe("onboarding.steps.core_settings.title");
    expect(
      wrapper.find("[data-testid=onboarding-address-internal]").exists(),
    ).toBe(true);
    expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
      "onboarding.next",
    );

    // the household is done, but a done step is still walked through
    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.invite_members.title");

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();
    expect(heading(wrapper)).toBe("onboarding.steps.finish.title");

    wrapper.unmount();
  });

  it("moves on from the plugins to the server settings", async () => {
    addMusicProvider();
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard({ step: "plugins" });
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.core_settings.title");

    wrapper.unmount();
  });

  it("offers to skip the household, which is optional", async () => {
    addEveryProvider();
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard();
    await flushPromises();

    // the only thing left to do is the one thing the wizard never insists on
    expect(heading(wrapper)).toBe("onboarding.steps.invite_members.title");
    expect(wrapper.find("[data-testid=onboarding-add-member]").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
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

  it("follows a deep link to the server settings", async () => {
    const wrapper = await mountWizard({ step: "core_settings" });
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.core_settings.title");
    expect(apiMock.getCoreConfig).toHaveBeenCalledWith("webserver");

    wrapper.unmount();
  });

  it("saves the server settings before it moves on", async () => {
    coreForm.hasUnsavedChanges = true;

    const wrapper = await mountWizard({ step: "core_settings" });
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    // Next takes the settings the user typed with it instead of leaving them
    // behind, then moves one step on
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "webserver",
      coreForm.values,
    );
    expect(heading(wrapper)).toBe("onboarding.steps.invite_members.title");

    wrapper.unmount();
  });

  it("stays on a step that is not done with the user yet", async () => {
    coreForm.hasUnsavedChanges = true;
    coreForm.valuesValidate = false;

    const wrapper = await mountWizard({ step: "core_settings" });
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    // the form is showing what is wrong with what they typed, so there is
    // nothing to save and neither way out of the step moves
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    expect(heading(wrapper)).toBe("onboarding.steps.core_settings.title");

    await wrapper.find("[data-testid=onboarding-back]").trigger("click");
    await flushPromises();

    expect(heading(wrapper)).toBe("onboarding.steps.core_settings.title");

    wrapper.unmount();
  });

  it("moves one step however often Next is clicked", async () => {
    coreForm.hasUnsavedChanges = true;
    let landSave: () => void = () => {};
    apiMock.saveCoreConfig.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          landSave = () => resolve();
        }),
    );

    const wrapper = await mountWizard({ step: "core_settings" });
    await flushPromises();

    // an impatient second click, landing before the button can even grey out
    const next = wrapper.find("[data-testid=onboarding-next]");
    void next.trigger("click");
    await next.trigger("click");
    await flushPromises();

    // the settings are still on their way out, and the footer says so
    expect(next.attributes("disabled")).toBeDefined();
    expect(
      wrapper.find("[data-testid=onboarding-back]").attributes("disabled"),
    ).toBeDefined();

    landSave();
    await flushPromises();

    // one save, and one step: an impatient second click is not a second move
    expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
    expect(heading(wrapper)).toBe("onboarding.steps.invite_members.title");

    wrapper.unmount();
  });

  describe("the member's welcome", () => {
    beforeEach(() => {
      signInAsMember();
    });

    it("opens on the welcome and says which wizard this is", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      expect(heading(wrapper)).toBe("onboarding.steps.welcome.title");
      // the eyebrow above it is the welcome's, not the setup's
      expect(wrapper.text()).toContain("onboarding.welcome_title");
      expect(wrapper.text()).not.toContain("onboarding.title");

      wrapper.unmount();
    });

    it("renders the own-sources step for a member who can add sources", async () => {
      signInAsMember(BUILTIN_ROLE_SCOPES.user);

      const wrapper = await mountWizard({ step: "own_sources" });
      await flushPromises();

      expect(heading(wrapper)).toBe("onboarding.steps.own_sources.title");
      // the step carries its own add-a-source button, wired to the dialog
      expect(
        wrapper.find("[data-testid=onboarding-add-provider]").exists(),
      ).toBe(true);

      wrapper.unmount();
    });

    it("walks the member from the question to the way out", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      await wrapper
        .find("[data-testid=onboarding-persona-enthusiast]")
        .trigger("click");
      await flushPromises();

      // answering moves them on, and from there it is all looking around
      expect(heading(wrapper)).toBe("onboarding.steps.whats_here.title");
      expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
        "onboarding.next",
      );

      await wrapper.find("[data-testid=onboarding-next]").trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.tour.title");

      await wrapper.find("[data-testid=onboarding-next]").trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.all_set.title");

      // the summary looks back at the one thing the welcome asked
      expect(wrapper.text()).toContain("onboarding.what_you_picked");
      expect(wrapper.text()).toContain(
        "onboarding.steps.welcome.enthusiast.label",
      );
      expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(
        false,
      );

      await wrapper.find("[data-testid=onboarding-finish]").trigger("click");
      await flushPromises();

      // the welcome completes nothing on the server; it simply closes and hands
      // the member the app it was showing them
      expect(apiMock.sendCommand).not.toHaveBeenCalled();

      wrapper.unmount();
    });

    it("keeps Next from advancing while the welcome answer is saving", async () => {
      // hold the persona answer mid-flight so the chosen card stays busy
      let landPersona: () => void = () => {};
      setUserPreferencesMock.mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            landPersona = () => resolve(true);
          }),
      );

      const wrapper = await mountWizard();
      await flushPromises();

      await wrapper
        .find("[data-testid=onboarding-persona-enthusiast]")
        .trigger("click");
      await flushPromises();

      // a Next while the answer is saving does not move the member on
      await wrapper.find("[data-testid=onboarding-next]").trigger("click");
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.welcome.title");

      // once it lands, the choice moves them on one step
      landPersona();
      await flushPromises();
      expect(heading(wrapper)).toBe("onboarding.steps.whats_here.title");

      wrapper.unmount();
    });

    it("opens on the summary once the member has answered", async () => {
      preferenceState.persona.value = "regular";

      const wrapper = await mountWizard();
      await flushPromises();

      // nothing left to ask, and the setup's summary is not theirs to land on
      expect(heading(wrapper)).toBe("onboarding.steps.all_set.title");

      wrapper.unmount();
    });

    it("looks back at the answer a member did give", async () => {
      preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";
      preferenceState.persona.value = "regular";

      const wrapper = await mountWizard();
      await flushPromises();

      const done = wrapper.findAll("[data-testid=onboarding-summary-done]");
      expect(done).toHaveLength(1);
      expect(done[0].text()).toContain("onboarding.steps.welcome.title");
      expect(done[0].text()).toContain(
        "onboarding.steps.welcome.regular.label",
      );
      expect(wrapper.text()).toContain("onboarding.what_you_picked");

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
