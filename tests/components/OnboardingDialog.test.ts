import OnboardingDialog from "@/components/onboarding/OnboardingDialog.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { START_LOCATION, type RouteLocationNormalized } from "vue-router";

const { onbState, pauseMock, routerState } = vi.hoisted(() => ({
  onbState: {
    active: { value: true } as { value: boolean },
  },
  pauseMock: vi.fn(),
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

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/composables/useOnboarding", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  onbState.active = ref(true);
  return {
    useOnboarding: () => ({
      active: onbState.active,
      pause: pauseMock,
    }),
  };
});

// the wizard body is covered on its own; here it only has to be reachable
vi.mock("@/components/onboarding/OnboardingWizard.vue", () => ({
  __esModule: true,
  default: { template: "<div data-testid='wizard-stub' />" },
}));

// the shadcn dialog is reka's to test; stub it so this covers the wrapper's own
// wiring: the close button, and what a dismiss attempt does
vi.mock("@/components/ui/dialog", () => ({
  Dialog: {
    name: "DialogStub",
    props: ["open"],
    emits: ["update:open"],
    template: "<div data-testid='dialog'><slot /></div>",
  },
  DialogContent: {
    name: "DialogContentStub",
    props: ["showCloseButton", "closeLabel"],
    emits: ["escapeKeyDown", "pointerDownOutside", "interactOutside"],
    template:
      "<div data-testid='content' :data-close-label='closeLabel'><slot /></div>",
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
  routerState.hooks = [];
  pauseMock.mockReset();
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

  it("keeps the dialog's close button", () => {
    expect(content(mountDialog()).props("showCloseButton")).not.toBe(false);
  });

  it("lets the admin leave the setup with Escape, not with a click beside it", () => {
    const dialog = content(mountDialog());

    for (const attempt of DISMISS_ATTEMPTS) {
      const event = { preventDefault: vi.fn() };
      dialog.vm.$emit(attempt, event);
      expect(event.preventDefault).toHaveBeenCalledTimes(
        attempt === "escapeKeyDown" ? 0 : 1,
      );
    }
  });

  it("pauses the setup when it is closed", () => {
    const wrapper = mountDialog();

    wrapper
      .findComponent({ name: "DialogStub" })
      .vm.$emit("update:open", false);

    expect(pauseMock).toHaveBeenCalledOnce();
  });

  it("pauses the setup when the user is taken to another page", () => {
    mountDialog();

    navigate("/settings/storage", "/settings");

    expect(pauseMock).toHaveBeenCalledWith({ force: true });
  });

  it("lets a page change pass once the setup is closed", () => {
    mountDialog();
    onbState.active.value = false;

    navigate("/settings/storage", "/settings");

    expect(pauseMock).not.toHaveBeenCalled();
  });

  it("stays open through the app's first navigation and on the same page", () => {
    mountDialog();

    navigate("/discover", START_LOCATION);
    navigate("/discover", "/discover");

    expect(pauseMock).not.toHaveBeenCalled();
  });

  it("names the setup", () => {
    expect(mountDialog().find("h2").text()).toBe("onboarding.title");
  });

  it("leaves the setup as it was when a dropped connection tears it down", () => {
    const wrapper = mountDialog();

    wrapper.unmount();

    expect(pauseMock).not.toHaveBeenCalled();
    expect(routerState.hooks).toHaveLength(0);
  });

  it("names the close button after what it does", () => {
    expect(content(mountDialog()).attributes("data-close-label")).toBe(
      "onboarding.pause",
    );
  });
});
