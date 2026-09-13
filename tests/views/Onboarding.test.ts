import { ProviderType, type Scope } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const {
  apiMock,
  authMock,
  preferenceState,
  providerConfigs,
  routerMock,
  routeState,
  setUserPreferenceMock,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providers: {} as Record<string, { name: string }>,
    providerManifests: {} as Record<string, { builtin: boolean }>,
    getProviderConfigs: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: { value: { onboard_done: false } },
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
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

// the dialog is covered where it lives; here it only has to be reachable
vi.mock("@/views/settings/AddProviderDialog.vue", () => ({
  default: { template: "<div />" },
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
    apiMock.getProviderConfigs.mockReset();
    apiMock.getProviderConfigs.mockImplementation(async () => [
      ...providerConfigs.list,
    ]);
    apiMock.subscribe.mockClear();
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
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
    ).toHaveLength(3);
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

  it("moves straight to the summary once everything is set up", async () => {
    addMusicProvider();
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);
    addProvider("party--1", "party", ProviderType.PLUGIN);
    routeState.route.query = { step: "intent" };

    const wrapper = await mountWizard();
    await flushPromises();

    await wrapper
      .find("[data-testid=onboarding-intent-music_hub]")
      .trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.finish.title",
    );

    wrapper.unmount();
  });
});
