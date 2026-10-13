import OnboardingDialog from "@/components/onboarding/OnboardingDialog.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { START_LOCATION, type RouteLocationNormalized } from "vue-router";

const { onbState, closeMock, pauseMock, markWelcomedMock, routerState } =
  vi.hoisted(() => ({
    onbState: {
      active: { value: true } as { value: boolean },
      isMember: true,
      awaitingAccount: { value: false } as { value: boolean },
    },
    closeMock: vi.fn(),
    pauseMock: vi.fn(),
    markWelcomedMock: vi.fn(),
    routerState: {
      hooks: [] as ((
        to: { path: string },
        from: { path: string },
        failure?: unknown,
      ) => void)[],
    },
  }));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({
    afterEach: (hook: (typeof routerState.hooks)[number]) => {
      routerState.hooks.push(hook);
      return () => {
        routerState.hooks = routerState.hooks.filter((known) => known !== hook);
      };
    },
  }),
}));

vi.mock("@/composables/useFirstRunSetup", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  onbState.awaitingAccount = ref(false);
  return {
    useFirstRunSetup: () => ({ awaitingAccount: onbState.awaitingAccount }),
  };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/composables/useOnboarding", async () => {
  const { ref, computed } = await vi.importActual<typeof import("vue")>("vue");
  onbState.active = ref(true);
  return {
    useOnboarding: () => ({
      active: onbState.active,
      ctx: computed(() => ({ isMember: onbState.isMember })),
      close: closeMock,
      pause: pauseMock,
      markWelcomed: markWelcomedMock,
    }),
  };
});

// the wizard body is covered on its own; here it only has to be reachable
vi.mock("@/components/onboarding/OnboardingWizard.vue", () => ({
  __esModule: true,
  default: { template: "<div data-testid='wizard-stub' />" },
}));

// the shadcn dialog is reka's to test; stub it so this covers the wrapper's own
// wiring: which track gets a close button, and what a dismiss attempt does
vi.mock("@/components/ui/dialog", () => ({
  Dialog: {
    name: "DialogStub",
    props: ["open"],
    emits: ["update:open"],
    template: "<div data-testid='dialog'><slot /></div>",
  },
  DialogContent: {
    name: "DialogContentStub",
    props: ["showCloseButton"],
    emits: ["escapeKeyDown", "pointerDownOutside", "interactOutside"],
    template:
      "<div data-testid='content' :data-show-close='showCloseButton'><slot /></div>",
  },
  DialogHeader: { template: "<div><slot /></div>" },
  DialogTitle: { template: "<h2><slot /></h2>" },
  DialogDescription: { template: "<p><slot /></p>" },
}));

const DISMISS_ATTEMPTS = [
  "escapeKeyDown",
  "pointerDownOutside",
  "interactOutside",
] as const;

function mountDialog() {
  return mount(OnboardingDialog);
}

function content(wrapper: ReturnType<typeof mountDialog>) {
  return wrapper.findComponent({ name: "DialogContentStub" });
}

/** Take the user from one page to another, as the router reports it. */
function navigate(to: string, from: string | typeof START_LOCATION) {
  const fromRoute = from === START_LOCATION ? from : { path: from };
  for (const hook of routerState.hooks) {
    hook({ path: to }, fromRoute as RouteLocationNormalized);
  }
}

beforeEach(() => {
  onbState.active.value = true;
  onbState.isMember = true;
  onbState.awaitingAccount.value = false;
  routerState.hooks = [];
  closeMock.mockReset();
  pauseMock.mockReset();
  markWelcomedMock.mockReset();
});

describe("OnboardingDialog", () => {
  it("renders the wizard while it is open", async () => {
    const wrapper = mountDialog();
    await flushPromises();
    expect(wrapper.find("[data-testid=wizard-stub]").exists()).toBe(true);
  });

  it("renders no wizard once it is closed", () => {
    onbState.active.value = false;

    expect(mountDialog().find("[data-testid=wizard-stub]").exists()).toBe(
      false,
    );
  });

  it("gives a close button to both tracks, but not before the account exists", () => {
    onbState.isMember = true;
    expect(content(mountDialog()).attributes("data-show-close")).toBe("true");

    onbState.isMember = false;
    expect(content(mountDialog()).attributes("data-show-close")).toBe("true");

    onbState.awaitingAccount.value = true;
    expect(content(mountDialog()).attributes("data-show-close")).toBe("false");
  });

  it("lets a member dismiss the welcome", () => {
    onbState.isMember = true;
    const dialog = content(mountDialog());

    for (const attempt of DISMISS_ATTEMPTS) {
      const event = { preventDefault: vi.fn() };
      dialog.vm.$emit(attempt, event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
  });

  it("lets the admin leave the setup with Escape, not with a click beside it", () => {
    onbState.isMember = false;
    const dialog = content(mountDialog());

    for (const attempt of DISMISS_ATTEMPTS) {
      const event = { preventDefault: vi.fn() };
      dialog.vm.$emit(attempt, event);
      expect(event.preventDefault).toHaveBeenCalledTimes(
        attempt === "escapeKeyDown" ? 0 : 1,
      );
    }
  });

  it("keeps the setup open before its account exists", () => {
    onbState.isMember = false;
    onbState.awaitingAccount.value = true;
    const event = { preventDefault: vi.fn() };

    content(mountDialog()).vm.$emit("escapeKeyDown", event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("closes when a member's dismiss goes through", () => {
    onbState.isMember = true;
    const wrapper = mountDialog();

    wrapper
      .findComponent({ name: "DialogStub" })
      .vm.$emit("update:open", false);

    expect(closeMock).toHaveBeenCalledOnce();
    // leaving the welcome marks the member, even if the async wizard never mounted
    expect(markWelcomedMock).toHaveBeenCalledOnce();
  });

  it("pauses the admin setup when it is closed", () => {
    onbState.isMember = false;
    const wrapper = mountDialog();

    wrapper
      .findComponent({ name: "DialogStub" })
      .vm.$emit("update:open", false);

    expect(pauseMock).toHaveBeenCalledOnce();
    expect(closeMock).not.toHaveBeenCalled();
    expect(markWelcomedMock).not.toHaveBeenCalled();
  });

  it("pauses the setup when the user is taken to another page", () => {
    onbState.isMember = false;
    mountDialog();

    navigate("/settings/storage", "/settings");

    expect(pauseMock).toHaveBeenCalledWith({ force: true });
  });

  it("keeps the setup open on a page change before its account exists", () => {
    onbState.isMember = false;
    onbState.awaitingAccount.value = true;
    mountDialog();

    navigate("/settings", "/discover");

    expect(pauseMock).not.toHaveBeenCalled();
  });

  it("closes the welcome when the member is taken to another page", () => {
    mountDialog();

    navigate("/settings", "/discover");

    expect(closeMock).toHaveBeenCalledOnce();
    expect(markWelcomedMock).toHaveBeenCalledOnce();
  });

  it("stays open through the app's first navigation and on the same page", () => {
    onbState.isMember = false;
    mountDialog();

    navigate("/discover", START_LOCATION);
    navigate("/discover", "/discover");

    expect(pauseMock).not.toHaveBeenCalled();
  });

  it("names the setup for the admin and the welcome for a member", () => {
    onbState.isMember = false;
    expect(mountDialog().find("h2").text()).toBe("onboarding.title");

    onbState.isMember = true;
    expect(mountDialog().find("h2").text()).toBe("onboarding.welcome_title");
  });

  it("resets the modal state when the shell tears it down", () => {
    // a sign-out unmounts the dialog; the next session must not inherit an
    // onboarding that was left open
    const wrapper = mountDialog();

    wrapper.unmount();

    expect(closeMock).toHaveBeenCalled();
    expect(routerState.hooks).toHaveLength(0);
  });
});
