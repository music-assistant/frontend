import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import { Scope } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, onboardingState } = vi.hoisted(() => ({
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  // the part of the onboarding context this step reads
  onboardingState: {
    homeAssistantAddon: false,
    homeAssistantConfigured: false,
  },
}));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/composables/useOnboarding", async () => {
  const { computed } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useOnboarding: () => ({ ctx: computed(() => ({ ...onboardingState })) }),
  };
});

enableAutoUnmount(afterEach);

/** The scopes this admin holds; everything, unless a test takes one away. */
function grantAllBut(...withheld: Scope[]) {
  authMock.hasScope.mockImplementation((scope) => !withheld.includes(scope));
}

function mountStep() {
  return mount(CoreSettingsStep, {
    global: {
      mocks: { $t: (key: string) => key },
      // the card is covered where it lives; here it only has to be reachable
      stubs: { RemoteAccessCard: true },
    },
  });
}

type Wrapper = ReturnType<typeof mountStep>;

function card(wrapper: Wrapper) {
  return wrapper.findComponent({ name: "RemoteAccessCard" });
}

function intro(wrapper: Wrapper) {
  return wrapper.find("[data-testid=onboarding-remote-access-intro]").text();
}

function homeAssistantLine(wrapper: Wrapper) {
  return wrapper.find("[data-testid=onboarding-remote-access-home-assistant]");
}

function networkHint(wrapper: Wrapper) {
  return wrapper.find("[data-testid=onboarding-network-hint]");
}

beforeEach(() => {
  vi.clearAllMocks();
  grantAllBut();
  onboardingState.homeAssistantAddon = false;
  onboardingState.homeAssistantConfigured = false;
});

describe("CoreSettingsStep", () => {
  describe("the intro", () => {
    it("is about listening away from home", () => {
      const wrapper = mountStep();

      expect(intro(wrapper)).toBe("onboarding.steps.core_settings.intro");
    });

    it("says the add-on is reached wherever Home Assistant is", () => {
      onboardingState.homeAssistantAddon = true;
      onboardingState.homeAssistantConfigured = true;

      const wrapper = mountStep();

      expect(intro(wrapper)).toBe("onboarding.steps.core_settings.intro_addon");
    });
  });

  describe("remote access", () => {
    it("is offered to whoever may switch it", () => {
      const wrapper = mountStep();

      expect(card(wrapper).exists()).toBe(true);
    });

    it("is kept from whoever may not switch it", () => {
      grantAllBut(Scope.SYSTEM_MANAGE);
      onboardingState.homeAssistantConfigured = true;

      const wrapper = mountStep();

      // the request would only fail at them, and the line about Home
      // Assistant goes with the switch it is about
      expect(card(wrapper).exists()).toBe(false);
      expect(homeAssistantLine(wrapper).exists()).toBe(false);
    });
  });

  describe("the line about Home Assistant", () => {
    it("is left out without Home Assistant", () => {
      const wrapper = mountStep();

      expect(homeAssistantLine(wrapper).exists()).toBe(false);
    });

    it("shows with Home Assistant connected", () => {
      onboardingState.homeAssistantConfigured = true;

      const wrapper = mountStep();

      expect(homeAssistantLine(wrapper).text()).toBe(
        "onboarding.steps.core_settings.remote.home_assistant",
      );
    });

    it("shows on the add-on, which connects Home Assistant by itself", () => {
      onboardingState.homeAssistantAddon = true;

      const wrapper = mountStep();

      expect(homeAssistantLine(wrapper).exists()).toBe(true);
    });
  });

  it("points to the network settings for anything else", () => {
    grantAllBut(Scope.SYSTEM_MANAGE);

    const wrapper = mountStep();

    expect(networkHint(wrapper).text()).toBe(
      "onboarding.steps.core_settings.network_hint",
    );
  });

  it("has nothing to hold the wizard up over", () => {
    const wrapper = mountStep();

    // with no say in leaving, the wizard's Next moves on at once
    expect(
      (wrapper.vm as { beforeLeave?: unknown }).beforeLeave,
    ).toBeUndefined();
  });
});
