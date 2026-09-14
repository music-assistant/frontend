import {
  ConfigEntryType,
  ProviderType,
  UserRole,
  type Scope,
  type User,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
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
    getCoreConfig: vi.fn(),
    getProviderConfigs: vi.fn(),
    saveCoreConfig: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: { value: { onboard_done: false } },
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
  // replaced with a reactive route by the vue-router mock factory below
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
  // the wizard watches ?step=, so the route it reads has to be reactive for a
  // deep link that arrives after the mount to be followed; every test loads a
  // fresh wizard, which runs this factory again, so hand out the same route
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
  await import("@/views/Onboarding.vue");
});

/**
 * A fresh wizard per test: the onboarding state lives for a whole session.
 * `fresh: false` opens the wizard again on the state a first visit left.
 */
async function mountWizard({ fresh = true } = {}) {
  if (fresh) vi.resetModules();
  const component = await import("@/views/Onboarding.vue");
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

/** Sign in as someone who lives here without running the place. */
function signInAsMember() {
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
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
    routeState.route.query = {};
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

  it("opens on the first step still to do and puts it in the query", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.intent.title",
    );
    expect(routerMock.replace).toHaveBeenCalledWith({
      query: { step: "intent" },
    });
    // nothing to go back to on the first step
    expect(wrapper.find("[data-testid=onboarding-back]").exists()).toBe(false);

    wrapper.unmount();
  });

  it("shows no step until the provider configurations are in", async () => {
    let handOverConfigs: (configs: unknown[]) => void = () => {};
    apiMock.getProviderConfigs.mockImplementation(
      () =>
        new Promise((resolve) => {
          handOverConfigs = resolve;
        }),
    );

    const wrapper = await mountWizard();
    await flushPromises();

    // no heading, no "step 1 of 0" and no step to flash past
    expect(wrapper.find("[data-testid=onboarding-view]").exists()).toBe(true);
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe("");
    expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(false);
    expect(routerMock.replace).not.toHaveBeenCalled();

    handOverConfigs([]);
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.intent.title",
    );

    wrapper.unmount();
  });

  it("follows a deep link and offers to skip an optional step", async () => {
    routeState.route.query = { step: "plugins" };

    const wrapper = await mountWizard();
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.plugins.title",
    );
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
    routeState.route.query = { step: "music_sources" };

    const wrapper = await mountWizard();
    await flushPromises();

    // deferred is not optional, but it is not something to hold the wizard up
    expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
      "onboarding.skip",
    );

    wrapper.unmount();
  });

  it("answers the intent question with the music hub when it is waved through", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    // the default answer is persisted, so neither the summary nor the
    // checklist keeps the question open and a second run starts past it
    expect(setUserPreferenceMock).toHaveBeenCalledOnce();
    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "music_hub",
    );
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.music_sources.title",
    );

    wrapper.unmount();
  });

  it("leaves an answer the user gave alone", async () => {
    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper
      .find("[data-testid=onboarding-intent-phone_apps]")
      .trigger("click");
    await flushPromises();

    // the step moves on through the same path, but the default never lands on
    // top of the answer
    expect(setUserPreferenceMock).toHaveBeenCalledOnce();
    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "phone_apps",
    );
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.players.title",
    );

    wrapper.unmount();
  });

  it("lists what is set up and what is left on the summary", async () => {
    routeState.route.query = { step: "finish" };
    addMusicProvider();

    const wrapper = await mountWizard();
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
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.intent.title",
    );

    wrapper.unmount();
  });

  it("falls back to the first step still to do for a step it does not know", async () => {
    routeState.route.query = { step: "plugins" };

    const wrapper = await mountWizard();
    await flushPromises();

    routeState.route.query = { step: "nope" };
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.intent.title",
    );

    wrapper.unmount();
  });

  it("stays on the step a provider turns up on", async () => {
    routeState.route.query = { step: "music_sources" };

    const wrapper = await mountWizard();
    await flushPromises();

    addMusicProvider();
    await reportProvidersUpdated();

    // the step is page state: ticking it off must not move the wizard on
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.music_sources.title",
    );
    expect(
      wrapper.findAll("[data-testid=onboarding-configured-provider]"),
    ).toHaveLength(1);

    wrapper.unmount();
  });

  it("skips over what was already set up when it moves on", async () => {
    addMusicProvider();

    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper
      .find("[data-testid=onboarding-intent-music_hub]")
      .trigger("click");
    await flushPromises();

    // the music sources were set up before the wizard opened, so they are not
    // put in front of the user again
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.players.title",
    );

    wrapper.unmount();
  });

  it("walks past the server settings on its way to the summary", async () => {
    addEveryProvider();
    addMember("sam-1");
    routeState.route.query = { step: "intent" };

    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper
      .find("[data-testid=onboarding-intent-music_hub]")
      .trigger("click");
    await flushPromises();

    // everything is set up, but a review is nothing to set up: it is shown
    // rather than skipped, and moving on from it is all the footer offers
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.core_settings.title",
    );
    expect(wrapper.find("[data-testid=onboarding-core-config]").exists()).toBe(
      true,
    );
    expect(wrapper.find("[data-testid=onboarding-next]").text()).toBe(
      "onboarding.next",
    );

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.finish.title",
    );

    wrapper.unmount();
  });

  it("moves on from the plugins to the server settings", async () => {
    addMusicProvider();
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);
    preferenceState.intent.value = "music_hub";
    routeState.route.query = { step: "plugins" };

    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.core_settings.title",
    );

    wrapper.unmount();
  });

  it("offers to skip the household, which is optional", async () => {
    addEveryProvider();
    preferenceState.intent.value = "music_hub";

    const wrapper = await mountWizard();
    await flushPromises();

    // the only thing left to do is the one thing the wizard never insists on
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.invite_members.title",
    );
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
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.finish.title",
    );

    wrapper.unmount();
  });

  it("follows a deep link to the server settings", async () => {
    routeState.route.query = { step: "core_settings" };

    const wrapper = await mountWizard();
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.core_settings.title",
    );
    expect(apiMock.getCoreConfig).toHaveBeenCalledWith("webserver");

    wrapper.unmount();
  });

  it("saves the server settings before it moves on", async () => {
    routeState.route.query = { step: "core_settings" };
    coreForm.hasUnsavedChanges = true;

    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    // Next is the only thing that moves the wizard, and it takes the settings
    // the user typed with it instead of leaving them behind
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "webserver",
      coreForm.values,
    );
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.invite_members.title",
    );

    wrapper.unmount();
  });

  it("stays on a step that is not done with the user yet", async () => {
    routeState.route.query = { step: "core_settings" };
    coreForm.hasUnsavedChanges = true;
    coreForm.valuesValidate = false;

    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper.find("[data-testid=onboarding-next]").trigger("click");
    await flushPromises();

    // the form is showing the user what is wrong with what they typed, so
    // there is nothing to save and neither way out of the step moves
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.core_settings.title",
    );

    await wrapper.find("[data-testid=onboarding-back]").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.core_settings.title",
    );

    wrapper.unmount();
  });

  it("moves one step however often Next is clicked", async () => {
    routeState.route.query = { step: "core_settings" };
    coreForm.hasUnsavedChanges = true;
    let landSave: () => void = () => {};
    apiMock.saveCoreConfig.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          landSave = () => resolve();
        }),
    );

    const wrapper = await mountWizard();
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
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.invite_members.title",
    );

    wrapper.unmount();
  });

  it("settles the step it opens on from this visit's own answer", async () => {
    addEveryProvider();
    preferenceState.intent.value = "music_hub";

    const first = await mountWizard();
    await flushPromises();

    // the household is still only the admin, so that is what is left to do
    expect(first.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.invite_members.title",
    );
    first.unmount();

    // someone was added from the user management screen since
    addMember("sam-1");
    const second = await mountWizard({ fresh: false });
    await flushPromises();

    // the wizard asks again rather than opening on what the last visit was told
    expect(apiMock.getAllUsers).toHaveBeenCalledTimes(2);
    expect(second.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.finish.title",
    );

    second.unmount();
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
      expect(routerMock.replace).toHaveBeenCalledWith({
        query: { step: "welcome" },
      });

      wrapper.unmount();
    });

    it("asks the server for nothing the welcome does not read", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      // the setup's provider configurations and household are an admin's
      // business; the welcome shows what is already running
      expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
      expect(apiMock.getAllUsers).not.toHaveBeenCalled();

      wrapper.unmount();
    });

    it("remembers that the member has been welcomed on the way out", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      // the question is still open while they are being asked it
      expect(setUserPreferencesMock).not.toHaveBeenCalled();

      wrapper.unmount();
      await flushPromises();

      // leaving is what counts: the member is never dropped in here again,
      // whether they answered, walked past it or went somewhere else
      expect(setUserPreferencesMock).toHaveBeenCalledOnce();
      expect(setUserPreferencesMock.mock.calls[0][0]).toHaveProperty(
        "onboarding.welcome",
      );
    });

    it("leaves the mark of an earlier welcome where it is", async () => {
      preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";

      const wrapper = await mountWizard();
      await flushPromises();
      wrapper.unmount();
      await flushPromises();

      expect(setUserPreferencesMock).not.toHaveBeenCalled();
    });

    it("walks the member from the question to the way out", async () => {
      apiMock.providers = {};
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
      expect(wrapper.text()).not.toContain("onboarding.set_up");
      expect(wrapper.find("[data-testid=onboarding-next]").exists()).toBe(
        false,
      );

      await wrapper.find("[data-testid=onboarding-finish]").trigger("click");
      await flushPromises();

      // nothing is completed on the server: the welcome simply hands them the
      // app it was showing them
      expect(apiMock.sendCommand).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });

      wrapper.unmount();
    });

    it("waits for the answer before Next moves the member on", async () => {
      let landAnswer: (saved: boolean) => void = () => {};
      setUserPreferencesMock.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            landAnswer = resolve;
          }),
      );

      const wrapper = await mountWizard();
      await flushPromises();

      await wrapper
        .find("[data-testid=onboarding-persona-regular]")
        .trigger("click");
      // an impatient Next while the answer is still on its way out
      void wrapper.find("[data-testid=onboarding-next]").trigger("click");
      await flushPromises();

      expect(heading(wrapper)).toBe("onboarding.steps.welcome.title");

      landAnswer(false);
      await flushPromises();

      // the account never took the answer, so the welcome is where the member
      // stays — and where they were told about it
      expect(heading(wrapper)).toBe("onboarding.steps.welcome.title");

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

    it("opens on the summary for a member who was welcomed before", async () => {
      preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";

      const wrapper = await mountWizard();
      await flushPromises();

      // being shown it is enough to be done with it; the settings link opens
      // the welcome itself again for whoever wants it
      expect(heading(wrapper)).toBe("onboarding.steps.all_set.title");

      wrapper.unmount();
    });

    it("has nothing to look back at when the question was walked past", async () => {
      preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";

      const wrapper = await mountWizard();
      await flushPromises();

      // the welcome has been shown, so nothing is left to do — but being done
      // with the member is not the same as the member having picked something
      expect(heading(wrapper)).toBe("onboarding.steps.all_set.title");
      expect(
        wrapper.findAll("[data-testid=onboarding-summary-done]"),
      ).toHaveLength(0);
      expect(wrapper.text()).not.toContain("onboarding.what_you_picked");
      expect(wrapper.find("[data-testid=onboarding-finish]").exists()).toBe(
        true,
      );

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

    it("lets a member who never answered finish all the same", async () => {
      const wrapper = await mountWizard();
      await flushPromises();

      // walking past the question instead of answering it
      for (const title of [
        "onboarding.steps.whats_here.title",
        "onboarding.steps.tour.title",
        "onboarding.steps.all_set.title",
      ]) {
        await wrapper.find("[data-testid=onboarding-next]").trigger("click");
        await flushPromises();
        expect(heading(wrapper)).toBe(title);
      }

      // the question is theirs to leave: the summary keeps it in reach rather
      // than in the way, and nothing was answered on their behalf
      expect(wrapper.text()).toContain("onboarding.still_to_do");
      expect(
        wrapper.findAll("[data-testid=onboarding-summary-pending]"),
      ).toHaveLength(1);
      expect(wrapper.text()).toContain("onboarding.steps.welcome.title");
      expect(setUserPreferencesMock).not.toHaveBeenCalled();

      await wrapper.find("[data-testid=onboarding-finish]").trigger("click");
      await flushPromises();

      expect(routerMock.replace).toHaveBeenCalledWith({ name: "discover" });
      expect(setUserPreferencesMock).toHaveBeenCalledOnce();
      expect(setUserPreferencesMock.mock.calls[0][0]).toHaveProperty(
        "onboarding.welcome",
      );

      wrapper.unmount();
    });
  });

  it("walks back through the steps it came past", async () => {
    addEveryProvider();
    addMember("sam-1");
    preferenceState.intent.value = "music_hub";
    routeState.route.query = { step: "finish" };

    const wrapper = await mountWizard();
    await flushPromises();

    // back stays on the running order, so a step that is done — or one there
    // was nothing to do on — can still be revisited
    for (const title of [
      "onboarding.steps.invite_members.title",
      "onboarding.steps.core_settings.title",
    ]) {
      await wrapper.find("[data-testid=onboarding-back]").trigger("click");
      await flushPromises();
      expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
        title,
      );
    }

    wrapper.unmount();
  });
});
