import { ConfigEntryType, ProviderType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const {
  apiMock,
  authMock,
  preferenceState,
  providerConfigs,
  routerMock,
  routeState,
  setUserPreferenceMock,
  users,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providers: {} as Record<string, { name: string }>,
    providerManifests: {} as Record<string, { builtin: boolean }>,
    getAllUsers: vi.fn(),
    getCoreConfig: vi.fn(),
    getProviderConfigs: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: { value: { onboard_done: false } },
  },
  authMock: { isAdmin: vi.fn(() => true) },
  // replaced with a real ref by the userPreferences mock factory below
  preferenceState: {
    intent: { value: undefined } as { value?: string },
    ready: false,
  },
  // what the server hands back as the provider configurations
  providerConfigs: { list: [] as Record<string, unknown>[] },
  // replaced with a reactive route by the vue-router mock factory below
  routeState: { route: { query: {} as Record<string, string> }, ready: false },
  routerMock: { push: vi.fn(), replace: vi.fn() },
  setUserPreferenceMock: vi.fn(),
  // what the server hands back as the user accounts
  users: { list: [] as ReturnType<typeof user>[] },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

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

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  if (!preferenceState.ready) {
    preferenceState.intent = ref<string | undefined>(undefined);
    preferenceState.ready = true;
  }
  return {
    setUserPreference: setUserPreferenceMock,
    useUserPreferences: () => ({ getPreference: () => preferenceState.intent }),
  };
});

/** A fresh wizard per test: the onboarding state lives for a whole session. */
async function mountWizard() {
  vi.resetModules();
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

/** Tell the wizard the server reported a provider change. */
async function reportProvidersUpdated() {
  const lastCall = apiMock.subscribe.mock.calls.at(-1) as unknown as [
    string,
    () => void,
  ];
  lastCall[1]();
  await flushPromises();
}

describe("Onboarding wizard", () => {
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
    apiMock.subscribe.mockClear();
    authMock.isAdmin.mockReturnValue(true);
    preferenceState.intent.value = undefined;
    routeState.route.query = {};
    routerMock.push.mockReset();
    routerMock.replace.mockReset();
    setUserPreferenceMock.mockReset();
    // the real one updates the preference before it ever reaches the server
    setUserPreferenceMock.mockImplementation(
      async (key: string, value: string) => {
        if (key === "onboarding.intent") preferenceState.intent.value = value;
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
});
