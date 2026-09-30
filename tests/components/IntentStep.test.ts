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

  it("holds the wizard until the answer has landed", async () => {
    const landAnswer = holdWrite();

    const wrapper = await mountStep();
    await card(wrapper, "phone_apps").trigger("click");

    // leaving while the answer is still on its way waits for it here, rather
    // than moving on with an answer the account has not taken yet
    const leaving = wrapper.vm.beforeLeave();
    landAnswer(true);

    await expect(leaving).resolves.toBe(true);
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

  it("walks on with the recommended answer when none was given", async () => {
    const wrapper = await mountStep();

    // the card that was showing as chosen is what moving on answers with
    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);
    expect(setUserPreferenceMock).toHaveBeenCalledWith(
      "onboarding.intent",
      "music_hub",
    );

    wrapper.unmount();
  });

  it("leaves an answer already on the account alone", async () => {
    preferenceState.intent.value = "phone_apps";

    const wrapper = await mountStep();

    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);
    expect(setUserPreferenceMock).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
