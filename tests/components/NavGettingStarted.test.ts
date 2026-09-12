import { ProviderType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, preferenceState, routerMock } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, { builtin: boolean }>,
    providers: {} as Record<
      string,
      { instance_id: string; domain: string; type: ProviderType }
    >,
    sendCommand: vi.fn(),
    serverInfo: { value: { onboard_done: false } },
  },
  authMock: { isAdmin: vi.fn(() => true) },
  // replaced with a real ref by the userPreferences mock factory below
  preferenceState: {
    intent: { value: undefined } as { value?: string },
    ready: false,
  },
  routerMock: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

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
  return mount(component.default);
}

function addProvider(instanceId: string, domain: string, type: ProviderType) {
  apiMock.providers[instanceId] = { instance_id: instanceId, domain, type };
  apiMock.providerManifests[domain] = { builtin: false };
}

describe("NavGettingStarted", () => {
  beforeEach(() => {
    apiMock.providerManifests = {};
    apiMock.providers = {};
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

    wrapper.unmount();
  });

  it("stops asking once only optional steps are left", async () => {
    preferenceState.intent.value = "music_hub";
    addProvider("spotify--1", "spotify", ProviderType.MUSIC);
    addProvider("sonos--1", "sonos", ProviderType.PLAYER);

    const wrapper = await mountChecklist();

    // the plugins are optional; nothing left blocks finishing
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
