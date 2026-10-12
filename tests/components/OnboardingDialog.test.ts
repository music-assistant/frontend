import OnboardingDialog from "@/components/onboarding/OnboardingDialog.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { onbState, closeMock, markWelcomedMock } = vi.hoisted(() => ({
  onbState: { active: { value: true } as { value: boolean }, isMember: true },
  closeMock: vi.fn(),
  markWelcomedMock: vi.fn(),
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/composables/useOnboarding", async () => {
  const { ref, computed } = await vi.importActual<typeof import("vue")>("vue");
  onbState.active = ref(true);
  return {
    useOnboarding: () => ({
      active: onbState.active,
      ctx: computed(() => ({ isMember: onbState.isMember })),
      close: closeMock,
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

beforeEach(() => {
  onbState.active.value = true;
  onbState.isMember = true;
  closeMock.mockReset();
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

  it("gives a member a close button and the admin none", () => {
    onbState.isMember = true;
    expect(content(mountDialog()).attributes("data-show-close")).toBe("true");

    onbState.isMember = false;
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

  it("keeps the admin setup from being dismissed", () => {
    onbState.isMember = false;
    const dialog = content(mountDialog());

    for (const attempt of DISMISS_ATTEMPTS) {
      const event = { preventDefault: vi.fn() };
      dialog.vm.$emit(attempt, event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }
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

  it("ignores a stray close request while the admin is being forced through", () => {
    onbState.isMember = false;
    const wrapper = mountDialog();

    wrapper
      .findComponent({ name: "DialogStub" })
      .vm.$emit("update:open", false);

    expect(closeMock).not.toHaveBeenCalled();
    expect(markWelcomedMock).not.toHaveBeenCalled();
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
  });
});
