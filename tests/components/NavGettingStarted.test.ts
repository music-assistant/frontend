import {
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
  preferenceState,
  providerConfigs,
  routerMock,
  storeState,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, { builtin: boolean }>,
    getAllUsers: vi.fn(),
    getProviderConfigs: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: { value: { onboard_done: false } },
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  // replaced with real refs by the userPreferences mock factory below
  preferenceState: {
    intent: { value: undefined } as { value?: string },
    persona: { value: undefined } as { value?: string },
    welcomedAt: { value: undefined } as { value?: string },
    ready: false,
  },
  // what the server hands back as the provider configurations
  providerConfigs: { list: [] as Record<string, unknown>[] },
  routerMock: { push: vi.fn(), replace: vi.fn() },
  // replaced with a reactive store by the store mock factory below: who is
  // signed in is what tells the two onboarding tracks apart
  storeState: {
    store: { currentUser: undefined } as { currentUser?: User },
    ready: false,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({ default: routerMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  if (!storeState.ready) {
    storeState.store = reactive({ currentUser: undefined as User | undefined });
    storeState.ready = true;
  }
  return { store: storeState.store };
});

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  // every test loads a fresh checklist, which runs this factory again: hand out
  // the same refs each time, so the answer a test gives survives the reload
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
    setUserPreference: vi.fn(),
    setUserPreferences: vi.fn(),
    useUserPreferences: () => ({
      getPreference: (key: string) => preferences[key] ?? { value: undefined },
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

// The checklist comes up with the onboarding state and the sidebar shell
// behind it. Every test mounts it on a fresh module registry, so that
// transform is paid here, once and outside any test's clock, instead of by
// whichever test happens to mount first.
beforeAll(async () => {
  await import("@/components/navigation/NavGettingStarted.vue");
});

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

// every test mounts the checklist on a fresh module registry, which brings the
// onboarding state up again and can take seconds under load
describe("NavGettingStarted", { timeout: 20_000 }, () => {
  beforeEach(() => {
    apiMock.providerManifests = {};
    providerConfigs.list = [];
    apiMock.getAllUsers.mockClear();
    apiMock.getProviderConfigs.mockReset();
    apiMock.getProviderConfigs.mockImplementation(async () => [
      ...providerConfigs.list,
    ]);
    apiMock.subscribe.mockClear();
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    storeState.store.currentUser = user({
      user_id: "admin-1",
      username: "admin",
      role: UserRole.ADMIN,
    });
    preferenceState.intent.value = undefined;
    preferenceState.persona.value = undefined;
    preferenceState.welcomedAt.value = undefined;
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
    // the checklist lists neither the household nor the server settings, so it
    // never makes an admin session wait on the users either
    expect(apiMock.getAllUsers).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("stays away from a guest, who is only passing through", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );
    storeState.store.currentUser = user({
      user_id: "guest-1",
      username: "guest",
      role: UserRole.GUEST,
    });

    const wrapper = await mountChecklist();

    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      false,
    );
    // and never asks the server what a guest cannot act on anyway
    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("asks a member the one thing the welcome asks", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    storeState.store.currentUser = user({
      user_id: "sam-1",
      username: "sam",
      role: UserRole.USER,
    });

    const wrapper = await mountChecklist();

    expect(
      wrapper
        .findAll("[data-testid=getting-started-step]")
        .map((step) => step.text()),
    ).toEqual(["onboarding.steps.welcome.title"]);
    expect(wrapper.find("[data-slot=badge]").text()).toBe("1");
    // the welcome reads none of the provider configurations, so a member never
    // waits on them and never fetches them
    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("onboarding.welcome_hint");

    wrapper.unmount();
  });

  it("stops asking a member who has already been welcomed", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    storeState.store.currentUser = user({
      user_id: "sam-1",
      username: "sam",
      role: UserRole.USER,
    });
    preferenceState.welcomedAt.value = "2024-01-02T03:04:05Z";

    const wrapper = await mountChecklist();

    // they have seen the welcome and left the question alone, which is an
    // answer of its own: the sidebar does not keep bringing it up
    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it("stops asking a member who has answered the welcome", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    storeState.store.currentUser = user({
      user_id: "sam-1",
      username: "sam",
      role: UserRole.USER,
    });
    preferenceState.persona.value = "regular";

    const wrapper = await mountChecklist();

    expect(wrapper.find("[data-testid=nav-getting-started]").exists()).toBe(
      false,
    );

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
