import type { User } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { createAccountMock, ctxState, storeState } = vi.hoisted(() => ({
  createAccountMock: vi.fn(),
  // replaced with a reactive state by the useOnboarding mock factory below:
  // whether the app is signed in is what the step waits for
  ctxState: { state: { signedIn: false }, ready: false },
  storeState: {
    store: { currentUser: undefined } as { currentUser?: User },
    ready: false,
  },
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  if (!storeState.ready) {
    storeState.store = reactive({ currentUser: undefined as User | undefined });
    storeState.ready = true;
  }
  return { store: storeState.store };
});

vi.mock("@/composables/useOnboarding", async () => {
  const { computed, reactive } =
    await vi.importActual<typeof import("vue")>("vue");
  if (!ctxState.ready) {
    ctxState.state = reactive({ signedIn: false });
    ctxState.ready = true;
  }
  return {
    useOnboarding: () => ({
      ctx: computed(() => ({ signedIn: ctxState.state.signedIn })),
    }),
  };
});

// the account is made where the composable lives; here it only has to answer
vi.mock("@/composables/useFirstRunSetup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/composables/useFirstRunSetup")>()),
  useFirstRunSetup: () => ({ createAccount: createAccountMock }),
}));

vi.mock("@/plugins/auth", () => ({ authManager: { setToken: vi.fn() } }));

vi.mock("@/plugins/api/helpers", () => ({ getDeviceName: () => "Browser" }));

import AccountStep from "@/components/onboarding/steps/AccountStep.vue";
import { AccountSetupError } from "@/composables/useFirstRunSetup";

function mountStep() {
  return mount(AccountStep, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

type Wrapper = ReturnType<typeof mountStep>;

/** Type the details in and submit the form. */
async function submitDetails(wrapper: Wrapper) {
  await wrapper.get('input[name="username"]').setValue("  marcel ");
  await wrapper.get('input[name="displayName"]').setValue("Marcel ");
  await wrapper.get('input[name="password"]').setValue("correct horse battery");
  await wrapper
    .get('input[name="confirmPassword"]')
    .setValue("correct horse battery");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
}

/** The app signing in with the account the step made. */
async function signIn() {
  storeState.store.currentUser = user({
    user_id: "admin-1",
    username: "marcel",
    display_name: "Marcel",
  });
  ctxState.state.signedIn = true;
  await flushPromises();
}

function errorText(wrapper: Wrapper): string | null {
  const alert = wrapper.find("[data-testid=onboarding-account-error]");
  return alert.exists() ? alert.text() : null;
}

function createButton(wrapper: Wrapper) {
  return wrapper.get("[data-testid=onboarding-account-create]");
}

beforeEach(() => {
  createAccountMock.mockReset();
  createAccountMock.mockResolvedValue("signing_in");
  ctxState.state.signedIn = false;
  storeState.store.currentUser = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AccountStep", () => {
  it("makes the account from the details, then waits for the app to sign in", async () => {
    const wrapper = mountStep();

    await submitDetails(wrapper);

    // what was typed, tidied up
    expect(createAccountMock).toHaveBeenCalledWith({
      username: "marcel",
      password: "correct horse battery",
      displayName: "Marcel",
    });
    expect(
      wrapper.get("[data-testid=onboarding-account-progress]").text(),
    ).toBe("onboarding.steps.account.signing_in");
    // the form is done: the account is there, whatever comes of the sign-in
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
    expect(wrapper.vm.busy).toBe(true);
    expect(wrapper.vm.ownsForwardAction).toBe(true);
    await expect(wrapper.vm.beforeLeave()).resolves.toBe(false);
    expect(wrapper.emitted("advance")).toBeUndefined();

    await signIn();

    // the wizard is asked to move on once the step has stopped being busy,
    // since it stands aside while a step is
    expect(wrapper.emitted("advance")).toHaveLength(1);
    expect(wrapper.vm.busy).toBe(false);
    expect(wrapper.vm.ownsForwardAction).toBe(false);
    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);
    expect(wrapper.get("[data-testid=onboarding-account-ready]").text()).toBe(
      "onboarding.steps.account.ready",
    );
    expect(wrapper.find("form").exists()).toBe(false);

    wrapper.unmount();
  });

  it("sends nothing before the details hold up", async () => {
    const wrapper = mountStep();

    await wrapper.get('input[name="username"]').setValue("m");
    await wrapper.get('input[name="password"]').setValue("short");
    await wrapper.get('input[name="confirmPassword"]').setValue("other");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createAccountMock).not.toHaveBeenCalled();
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(3);
    expect(wrapper.text()).toContain("auth.username_min_length");
    expect(wrapper.text()).toContain("auth.password_min_length");
    expect(wrapper.text()).toContain("auth.passwords_must_match");

    wrapper.unmount();
  });

  it("keeps the details here with the server's reason when it refuses", async () => {
    createAccountMock.mockRejectedValue(
      new AccountSetupError("Username must be at least 2 characters"),
    );
    const wrapper = mountStep();

    await submitDetails(wrapper);

    expect(errorText(wrapper)).toBe("Username must be at least 2 characters");
    // another go is open
    expect(createButton(wrapper).attributes("disabled")).toBeUndefined();
    expect(wrapper.vm.busy).toBe(false);
    expect(wrapper.emitted("advance")).toBeUndefined();

    wrapper.unmount();
  });

  it("says so in its own words when the server gave no reason", async () => {
    createAccountMock.mockRejectedValue(new AccountSetupError(null));
    const wrapper = mountStep();

    await submitDetails(wrapper);

    expect(errorText(wrapper)).toBe("onboarding.steps.account.failed");

    wrapper.unmount();
  });

  it("shows the way back to the client the setup was started from", async () => {
    createAccountMock.mockResolvedValue("handed_back");
    const wrapper = mountStep();

    await submitDetails(wrapper);

    expect(
      wrapper.get("[data-testid=onboarding-account-handed-back]").text(),
    ).toBe("onboarding.steps.account.handed_back");
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.vm.busy).toBe(false);
    expect(wrapper.emitted("advance")).toBeUndefined();

    wrapper.unmount();
  });

  it("gives up waiting for the sign-in, with the account there all the same", async () => {
    // the timers the wait runs on, and nothing else: flushing promises has
    // timers of its own to keep
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = mountStep();

    await submitDetails(wrapper);
    vi.advanceTimersByTime(20_000);
    await nextTick();

    expect(errorText(wrapper)).toBe("onboarding.steps.account.sign_in_failed");
    expect(wrapper.vm.busy).toBe(false);
    // there is no second account to make
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
    expect(wrapper.emitted("advance")).toBeUndefined();

    wrapper.unmount();
  });
});
