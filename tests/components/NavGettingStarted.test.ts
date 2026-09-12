import { ProviderType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, preferenceState, providerConfigs, routerMock } =
  vi.hoisted(() => ({
    apiMock: {
      players: {} as Record<string, unknown>,
      providerManifests: {} as Record<string, { builtin: boolean }>,
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
    routerMock: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  // every test loads a fresh checklist, which runs this factory again: hand out
  // the same ref each time, so the answer a test gives survives the reload
  if (!preferenceState.ready) {
    preferenceState.intent = ref<string | undefined>(undefined);
    preferenceState.ready = true;
  }
  return {
    setUserPreference: vi.fn(),
    useUserPreferences: () => ({
      getPreference: () => preferenceState.intent,
    }),
  };
});

// The sidebar shell and the popover drag half the app in behind them; only the
// slots matter here, so the checklist renders in one piece.
vi.mock("@/components/ui/sidebar", () => {
  const slotHost = { template: "<div><slot /></div>" };
  return {
    SidebarGroup: slotHost,
    SidebarGroupContent: slotHost,
    SidebarMenu: slotHost,
    SidebarMenuButton: slotHost,
    SidebarMenuItem: slotHost,
    useSidebar: () => ({ isMobile: { value: false }, setOpenMobile: vi.fn() }),
  };
});

vi.mock("@/components/ui/popover", () => {
  const slotHost = { template: "<div><slot /></div>" };
  return {
    Popover: slotHost,
    PopoverContent: slotHost,
    PopoverTrigger: slotHost,
  };
});

vi.mock("vue-router", () => ({ useRouter: () => routerMock }));

// echo the count back, so a test can tell which number a label was given
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, count?: unknown) =>
      typeof count === "number" ? `${key}:${count}` : key,
  }),
}));

/** A fresh checklist per test: the dismissal lives for a whole session. */
async function mountChecklist() {
  vi.resetModules();
  const component =
    await import("@/components/navigation/NavGettingStarted.vue");
  const wrapper = mount(component.default);
  // the checklist fetches the provider configurations as it comes up
  await flushPromises();
  return wrapper;
}

function addProvider(instanceId: string, domain: string, type: ProviderType) {
  providerConfigs.list.push({
    instance_id: instanceId,
    domain,
    type,
    name: null,
    enabled: true,
    last_error: null,
  });
  apiMock.providerManifests[domain] = { builtin: false };
}

describe("NavGettingStarted", () => {
  beforeEach(() => {
    apiMock.providerManifests = {};
    providerConfigs.list = [];
    apiMock.getProviderConfigs.mockReset();
    apiMock.getProviderConfigs.mockImplementation(async () => [
      ...providerConfigs.list,
    ]);
    apiMock.subscribe.mockClear();
    authMock.isAdmin.mockReturnValue(true);
    preferenceState.intent.value = undefined;
    routerMock.push.mockReset();
  });

  it("counts the steps that are still to do", async () => {
    const wrapper = await mountChecklist();

    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      true,
    );
    const badge = wrapper.find("[data-slot=badge]");
    expect(badge.text()).toBe("3");
    expect(badge.attributes("aria-label")).toBe("onboarding.steps_to_go:3");

    wrapper.unmount();
  });

  it("stays away from anyone who is not an admin", async () => {
    authMock.isAdmin.mockReturnValue(false);

    const wrapper = await mountChecklist();

    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      false,
    );
    // and never asks the server what a non-admin cannot act on anyway
    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("counts nothing until the provider configurations are in", async () => {
    let handOverConfigs: (configs: unknown[]) => void = () => {};
    apiMock.getProviderConfigs.mockImplementation(
      () =>
        new Promise((resolve) => {
          handOverConfigs = resolve;
        }),
    );

    const wrapper = await mountChecklist();

    // an empty list is not the same as nothing being set up
    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      false,
    );

    handOverConfigs([]);
    await flushPromises();

    expect(wrapper.find("[data-slot=badge]").text()).toBe("3");

    wrapper.unmount();
  });

  it("lists exactly the steps it counts as still to do", async () => {
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const wrapper = await mountChecklist();

    // the always optional plugins are neither listed nor counted; the players
    // are set up, so they are listed with a tick instead
    expect(
      wrapper
        .findAll("[data-testid=getting-started-step]")
        .map((step) => step.text()),
    ).toEqual([
      "onboarding.steps.intent.title",
      "onboarding.steps.music_sources.title",
      "onboarding.steps.players.title",
    ]);
    expect(
      wrapper.findAll("[data-testid=getting-started-step] .lucide-circle-icon"),
    ).toHaveLength(2);
    expect(wrapper.find("[data-slot=badge]").text()).toBe("2");

    wrapper.unmount();
  });

  it("keeps asking for a music source that was only deferred", async () => {
    preferenceState.intent.value = "phone_apps";
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const wrapper = await mountChecklist();

    // streaming from phone apps puts the music sources last, it does not take
    // the nudge to add one away
    expect(
      wrapper
        .findAll("[data-testid=getting-started-step]")
        .map((step) => step.text()),
    ).toEqual([
      "onboarding.steps.intent.title",
      "onboarding.steps.players.title",
      "onboarding.steps.music_sources.title",
    ]);
    expect(wrapper.find("[data-slot=badge]").text()).toBe("1");

    wrapper.unmount();
  });

  it("stops asking once only optional steps are left", async () => {
    preferenceState.intent.value = "music_hub";
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const wrapper = await mountChecklist();

    // the plugins are optional: nothing left is asked for
    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it("hides for the session, until a step it did not list turns up", async () => {
    preferenceState.intent.value = "music_hub";
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);

    const wrapper = await mountChecklist();
    expect(wrapper.find("[data-slot=badge]").text()).toBe("1");

    await wrapper
      .find("[data-testid=getting-started-dismiss]")
      .trigger("click");
    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      false,
    );

    // the intent question coming back is a step the dismissal never covered
    preferenceState.intent.value = undefined;
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      true,
    );

    wrapper.unmount();
  });
});
