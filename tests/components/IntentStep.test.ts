import type { Scope } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, authMock, preferenceState, setUserPreferenceMock } =
  vi.hoisted(() => ({
    apiMock: {
      players: {} as Record<string, unknown>,
      providers: {} as Record<string, { name: string }>,
      providerManifests: {} as Record<string, { builtin: boolean }>,
      getAllUsers: vi.fn(async () => []),
      getProviderConfigs: vi.fn(async () => []),
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
    setUserPreferenceMock: vi.fn(),
  }));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("@/plugins/store", () => ({ store: { currentUser: undefined } }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/composables/userPreferences", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  // every test loads a fresh step, which runs this factory again: hand out the
  // same ref each time, so the answer a test gives survives the reload
  if (!preferenceState.ready) {
    preferenceState.intent = ref<string | undefined>(undefined);
    preferenceState.ready = true;
  }
  return {
    setUserPreference: setUserPreferenceMock,
    setUserPreferences: vi.fn(),
    useUserPreferences: () => ({
      getPreference: (key: string) =>
        key === "onboarding.intent" ? preferenceState.intent : ref(undefined),
    }),
  };
});

// Every test mounts the step on a fresh module registry, so the transform of
// its module graph is paid at module scope, where no test or hook clock runs,
// instead of by whichever test happens to mount first.
await import("@/components/onboarding/steps/IntentStep.vue");

/** A fresh step per test: the onboarding state lives for a whole session. */
async function mountStep() {
  vi.resetModules();
  const component =
    await import("@/components/onboarding/steps/IntentStep.vue");
  const wrapper = mount(component.default, {
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function card(wrapper: Awaited<ReturnType<typeof mountStep>>, intent: string) {
  return wrapper.find(`[data-testid=onboarding-intent-${intent}]`);
}

/** A write the test lands itself, so the step is caught with it in flight. */
function holdWrite() {
  let landAnswer: (saved: boolean) => void = () => {};
  setUserPreferenceMock.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        landAnswer = resolve;
      }),
  );
  return (saved: boolean) => landAnswer(saved);
}

describe("IntentStep", () => {
  beforeEach(() => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    preferenceState.intent.value = undefined;
    setUserPreferenceMock.mockReset();
    // the real one says whether the server took the answer
    setUserPreferenceMock.mockResolvedValue(true);
  });

  it("moves on once the picked answer has landed", async () => {
    const wrapper = await mountStep();

    await card(wrapper, "phone_apps").trigger("click");
    await flushPromises();

    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "phone_apps",
    );
    expect(wrapper.emitted("advance")).toHaveLength(1);

    wrapper.unmount();
  });

  it("stays here when the answer did not land", async () => {
    setUserPreferenceMock.mockResolvedValue(false);

    const wrapper = await mountStep();
    await card(wrapper, "phone_apps").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("advance")).toBeUndefined();
    // and the cards are the admin's to try again with
    expect(card(wrapper, "phone_apps").attributes("disabled")).toBeUndefined();

    wrapper.unmount();
  });

  it("holds the wizard until the answer has landed", async () => {
    const landAnswer = holdWrite();

    const wrapper = await mountStep();
    await card(wrapper, "phone_apps").trigger("click");

    // the cards wait for the answer, and the one on its way says so
    expect(card(wrapper, "music_hub").attributes("disabled")).toBeDefined();
    expect(card(wrapper, "phone_apps").attributes("aria-busy")).toBe("true");

    // leaving while the answer is still on its way waits for it here, rather
    // than moving on with an answer the account has not taken yet
    const leaving = wrapper.vm.beforeLeave();
    landAnswer(true);

    await expect(leaving).resolves.toBe(true);
    await flushPromises();
    expect(wrapper.emitted("advance")).toHaveLength(1);

    wrapper.unmount();
  });

  it("keeps the wizard here when the answer did not land", async () => {
    const landAnswer = holdWrite();

    const wrapper = await mountStep();
    await card(wrapper, "phone_apps").trigger("click");

    const leaving = wrapper.vm.beforeLeave();
    landAnswer(false);

    await expect(leaving).resolves.toBe(false);
    expect(wrapper.emitted("advance")).toBeUndefined();

    wrapper.unmount();
  });

  it("takes one answer however often it is clicked", async () => {
    const landAnswer = holdWrite();

    const wrapper = await mountStep();
    const chosen = card(wrapper, "music_hub");
    void chosen.trigger("click");
    await chosen.trigger("click");

    landAnswer(true);
    await flushPromises();

    expect(setUserPreferenceMock).toHaveBeenCalledOnce();
    expect(wrapper.emitted("advance")).toHaveLength(1);

    wrapper.unmount();
  });

  it("shows nothing as chosen until the admin picks", async () => {
    const wrapper = await mountStep();

    // the recommended option is only badged, so the question is the admin's
    // to answer
    expect(card(wrapper, "music_hub").attributes("aria-pressed")).toBe("false");
    expect(card(wrapper, "phone_apps").attributes("aria-pressed")).toBe(
      "false",
    );
    expect(card(wrapper, "music_hub").text()).toContain("recommended");
    expect(card(wrapper, "phone_apps").text()).not.toContain("recommended");

    wrapper.unmount();
  });

  it("answers nothing when the wizard leaves it unanswered", async () => {
    const wrapper = await mountStep();

    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);
    expect(setUserPreferenceMock).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("shows the answer already on the account, without moving on", async () => {
    preferenceState.intent.value = "phone_apps";

    const wrapper = await mountStep();

    expect(card(wrapper, "phone_apps").attributes("aria-pressed")).toBe("true");
    expect(card(wrapper, "music_hub").attributes("aria-pressed")).toBe("false");
    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);
    expect(setUserPreferenceMock).not.toHaveBeenCalled();
    expect(wrapper.emitted("advance")).toBeUndefined();

    wrapper.unmount();
  });

  it("holds the way on itself, so the wizard shows no Next", async () => {
    const wrapper = await mountStep();

    expect(wrapper.vm.ownsForwardAction).toBe(true);

    wrapper.unmount();
  });
});
