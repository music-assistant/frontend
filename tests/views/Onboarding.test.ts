import { ProviderType } from "@/plugins/api/interfaces";
import Onboarding from "@/views/Onboarding.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, preferenceState, routerMock, routeState } =
  vi.hoisted(() => ({
    apiMock: {
      players: {} as Record<string, unknown>,
      providerManifests: {} as Record<string, { builtin: boolean }>,
      providers: {} as Record<string, unknown>,
      sendCommand: vi.fn(),
      serverInfo: { value: { onboard_done: false } },
    },
    authMock: { isAdmin: vi.fn(() => true) },
    // replaced with a real ref by the userPreferences mock factory below
    preferenceState: { intent: { value: undefined } as { value?: string } },
    // replaced with a reactive route by the vue-router mock factory below
    routeState: { route: { query: {} as Record<string, string> } },
    routerMock: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock("@/plugins/api", async () => {
  // the real maps are reactive, and the wizard's context is a computed over
  // them: plain objects would leave it stale between tests
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.players = reactive({});
  apiMock.providerManifests = reactive({});
  apiMock.providers = reactive({});
  return { api: apiMock, default: apiMock };
});

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-router", async () => {
  // the wizard watches ?step=, so the route it reads has to be reactive for a
  // deep link that arrives after the mount to be followed
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  routeState.route = reactive({ query: {} as Record<string, string> });
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
  preferenceState.intent = ref<string | undefined>(undefined);
  return {
    setUserPreference: vi.fn(),
    useUserPreferences: () => ({ getPreference: () => preferenceState.intent }),
  };
});

function clear(map: Record<string, unknown>) {
  for (const key of Object.keys(map)) delete map[key];
}

function mountWizard() {
  return mount(Onboarding, { global: { mocks: { $t: (key: string) => key } } });
}

function addMusicProvider() {
  apiMock.providers["spotify--1"] = {
    instance_id: "spotify--1",
    domain: "spotify",
    name: "Spotify",
    type: ProviderType.MUSIC,
    available: true,
  };
  apiMock.providerManifests.spotify = { builtin: false };
}

describe("Onboarding wizard", () => {
  beforeEach(() => {
    clear(apiMock.players);
    clear(apiMock.providerManifests);
    clear(apiMock.providers);
    authMock.isAdmin.mockReturnValue(true);
    routeState.route.query = {};
    routerMock.push.mockReset();
    routerMock.replace.mockReset();
  });

  it("opens on the first step still to do and puts it in the query", async () => {
    const wrapper = mountWizard();
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

  it("follows a deep link and offers to skip an optional step", async () => {
    routeState.route.query = { step: "plugins" };

    const wrapper = mountWizard();
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

  it("lists what is set up and what is left on the summary", async () => {
    routeState.route.query = { step: "finish" };
    addMusicProvider();

    const wrapper = mountWizard();
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

    const wrapper = mountWizard();
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

    const wrapper = mountWizard();
    await flushPromises();

    addMusicProvider();
    await flushPromises();

    // the step is page state: ticking it off must not move the wizard on
    expect(wrapper.find("[data-testid=onboarding-heading]").text()).toBe(
      "onboarding.steps.music_sources.title",
    );
    expect(
      wrapper.findAll("[data-testid=onboarding-configured-provider]"),
    ).toHaveLength(1);

    wrapper.unmount();
  });
});
