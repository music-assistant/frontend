import { UserRole, type Scope, type User } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const {
  apiMock,
  authMock,
  preferenceState,
  setUserPreferencesMock,
  storeMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    providers: {} as Record<string, { name: string }>,
    providerManifests: {} as Record<string, { builtin: boolean }>,
    getAllUsers: vi.fn(async () => []),
    getProviderConfigs: vi.fn(async () => []),
    subscribe: vi.fn(() => vi.fn()),
    sendCommand: vi.fn(),
    serverInfo: { value: { onboard_done: true } },
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  // replaced with a real ref by the userPreferences mock factory below
  preferenceState: {
    persona: { value: undefined } as { value?: string },
    ready: false,
  },
  setUserPreferencesMock: vi.fn(),
  storeMock: { currentUser: undefined as User | undefined },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

// the step reaches for the same translator its template does; echo the name
// back, so a test can tell it reached the greeting
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, params?: Record<string, unknown>) =>
    params?.name ? `${key}:${params.name}` : key,
}));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  // every test loads a fresh step, which runs this factory again: hand out the
  // same ref each time, so the answer a test gives survives the reload
  if (!preferenceState.ready) {
    preferenceState.persona = ref<string | undefined>(undefined);
    preferenceState.ready = true;
  }
  return {
    setUserPreference: vi.fn(),
    setUserPreferences: setUserPreferencesMock,
    useUserPreferences: () => ({
      getPreference: (key: string) =>
        key === "onboarding.persona" ? preferenceState.persona : ref(undefined),
    }),
  };
});

/** A fresh step per test: the onboarding state lives for a whole session. */
async function mountStep() {
  vi.resetModules();
  const component =
    await import("@/components/onboarding/steps/WelcomeStep.vue");
  const wrapper = mount(component.default, {
    global: {
      mocks: {
        // echo the name back, so a test can tell it reached the greeting
        $t: (key: string, params?: Record<string, unknown>) =>
          params?.name ? `${key}:${params.name}` : key,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function card(wrapper: Awaited<ReturnType<typeof mountStep>>, persona: string) {
  return wrapper.find(`[data-testid=onboarding-persona-${persona}]`);
}

describe("WelcomeStep", () => {
  beforeEach(() => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    storeMock.currentUser = user({
      user_id: "sam-1",
      username: "sam",
      display_name: "Sam",
      role: UserRole.USER,
    });
    preferenceState.persona.value = undefined;
    setUserPreferencesMock.mockReset();
    // the real one says whether the server took the answer
    setUserPreferencesMock.mockResolvedValue(true);
    toastMock.error.mockReset();
  });

  it("greets the member by the name they go by", async () => {
    const wrapper = await mountStep();

    expect(wrapper.find("[data-testid=onboarding-greeting]").text()).toBe(
      "onboarding.steps.welcome.description:Sam",
    );

    wrapper.unmount();
  });

  it("falls back on the username of a member without a display name", async () => {
    storeMock.currentUser = user({ username: "sam", display_name: null });

    const wrapper = await mountStep();

    expect(wrapper.find("[data-testid=onboarding-greeting]").text()).toBe(
      "onboarding.steps.welcome.description:sam",
    );

    wrapper.unmount();
  });

  it("offers both ways to listen, and says what they change", async () => {
    const wrapper = await mountStep();

    expect(card(wrapper, "enthusiast").text()).toContain(
      "onboarding.steps.welcome.enthusiast.label",
    );
    expect(card(wrapper, "regular").text()).toContain(
      "onboarding.steps.welcome.regular.label",
    );
    // the answer is a handful of defaults, not a door closing
    expect(wrapper.text()).toContain("onboarding.steps.welcome.defaults_hint");

    wrapper.unmount();
  });

  it("persists the answer and moves the wizard on", async () => {
    const wrapper = await mountStep();

    await card(wrapper, "enthusiast").trigger("click");
    await flushPromises();

    expect(setUserPreferencesMock).toHaveBeenCalledWith(
      {
        "onboarding.persona": "enthusiast",
        show_waveform: true,
        visualizer_enabled: true,
      },
      // the step's own message is the only one the member should get
      { suppressGlobalError: true },
    );
    expect(wrapper.emitted("advance")).toHaveLength(1);

    wrapper.unmount();
  });

  it("stays put when the answer could not be saved", async () => {
    setUserPreferencesMock.mockResolvedValue(false);

    const wrapper = await mountStep();
    await card(wrapper, "enthusiast").trigger("click");
    await flushPromises();

    // walking on would leave them with a player the account never agreed to
    expect(toastMock.error).toHaveBeenCalledWith(
      "onboarding.steps.welcome.save_failed",
    );
    expect(wrapper.emitted("advance")).toBeUndefined();
    // and the cards are theirs to try again with
    expect(card(wrapper, "enthusiast").attributes("disabled")).toBeUndefined();

    wrapper.unmount();
  });

  it("asks the question the cards answer, for whoever cannot see them", async () => {
    const wrapper = await mountStep();

    const group = wrapper.find("[role=group]");
    expect(group.attributes("aria-labelledby")).toBe(
      wrapper.find("[data-testid=onboarding-greeting]").attributes("id"),
    );

    wrapper.unmount();
  });

  it("shows the answer the member already gave", async () => {
    preferenceState.persona.value = "regular";

    const wrapper = await mountStep();

    // coming back to the welcome shows what it was answered with, and lets
    // them answer it again
    expect(card(wrapper, "regular").attributes("aria-pressed")).toBe("true");
    expect(card(wrapper, "enthusiast").attributes("aria-pressed")).toBe(
      "false",
    );

    wrapper.unmount();
  });

  it("holds the wizard until the answer has landed", async () => {
    let landAnswer: (saved: boolean) => void = () => {};
    setUserPreferencesMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          landAnswer = resolve;
        }),
    );

    const wrapper = await mountStep();
    await card(wrapper, "regular").trigger("click");

    // Next while the answer is still on its way waits for it here, instead of
    // walking the member on and telling them about it from the next step
    const leaving = wrapper.vm.beforeLeave();
    landAnswer(true);

    await expect(leaving).resolves.toBe(true);
    expect(toastMock.error).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("keeps the wizard here when the answer did not land", async () => {
    let landAnswer: (saved: boolean) => void = () => {};
    setUserPreferencesMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          landAnswer = resolve;
        }),
    );

    const wrapper = await mountStep();
    await card(wrapper, "regular").trigger("click");

    const leaving = wrapper.vm.beforeLeave();
    landAnswer(false);

    await expect(leaving).resolves.toBe(false);
    // told on the step that asked, and still standing on it
    expect(toastMock.error).toHaveBeenCalledOnce();
    expect(wrapper.emitted("advance")).toBeUndefined();

    wrapper.unmount();
  });

  it("holds the wizard up over nothing", async () => {
    const wrapper = await mountStep();

    // the question is theirs to walk past
    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);

    wrapper.unmount();
  });

  it("takes one answer however often it is clicked", async () => {
    let landAnswer: () => void = () => {};
    setUserPreferencesMock.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          landAnswer = () => resolve(true);
        }),
    );

    const wrapper = await mountStep();
    const chosen = card(wrapper, "regular");
    void chosen.trigger("click");
    await chosen.trigger("click");

    // the answer is on its way to the server, and the cards say so
    expect(chosen.attributes("disabled")).toBeDefined();

    landAnswer();
    await flushPromises();

    expect(setUserPreferencesMock).toHaveBeenCalledOnce();
    expect(wrapper.emitted("advance")).toHaveLength(1);

    wrapper.unmount();
  });
});
