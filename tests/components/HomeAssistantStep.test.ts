import HomeAssistantStep from "@/components/onboarding/steps/HomeAssistantStep.vue";
import type { ConfiguredProvider } from "@/composables/useOnboarding";
import { ProviderStatus, ProviderType } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import type { StepPrimaryAction } from "@/helpers/onboarding";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, onboardingState } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, { has_setup_flow: boolean }>,
  },
  // replaced with a real ref by the useOnboarding mock factory below, so the
  // step shows whatever a test says is set up
  onboardingState: {
    plugins: { value: [] as ConfiguredProvider[] },
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/composables/useOnboarding", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  onboardingState.plugins = ref<ConfiguredProvider[]>([]);
  return {
    configuredProviders: (type: ProviderType) =>
      type === ProviderType.PLUGIN ? onboardingState.plugins.value : [],
  };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the icon reaches for artwork and a theme this bare mount does not set up
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<i />",
  },
}));

function configured(
  domain: string,
  overrides: Partial<ConfiguredProvider> = {},
): ConfiguredProvider {
  return {
    instance_id: `${domain}--1`,
    name: domain,
    domain,
    needsAttention: false,
    status: ProviderStatus.LOADED,
    ...overrides,
  };
}

function mountStep() {
  return mount(HomeAssistantStep, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

type Wrapper = ReturnType<typeof mountStep>;

function testId(wrapper: Wrapper, id: string) {
  return wrapper.find(`[data-testid=${id}]`);
}

// the step's own way forward, which the wizard shows as its main button
const primaryAction = (wrapper: Wrapper) =>
  (wrapper.vm as unknown as { primaryAction?: StepPrimaryAction })
    .primaryAction;

describe("HomeAssistantStep", () => {
  beforeEach(() => {
    onboardingState.plugins.value = [];
    apiMock.providerManifests = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists what connecting brings", () => {
    const wrapper = mountStep();

    expect(
      testId(wrapper, "onboarding-invitation-features")
        .findAll("li")
        .map((item) => item.text()),
    ).toEqual([
      "onboarding.steps.home_assistant.features.players",
      "onboarding.steps.home_assistant.features.controls",
      "onboarding.steps.home_assistant.features.sign_in",
      "onboarding.steps.home_assistant.features.remote_access",
    ]);
    wrapper.unmount();
  });

  it("offers Connect as the step's main action, and says it is optional", () => {
    const wrapper = mountStep();

    expect(primaryAction(wrapper)?.labelKey).toBe(
      "onboarding.steps.home_assistant.connect",
    );
    // the wizard's footer holds it, so the step has no button of its own
    expect(wrapper.find("button").exists()).toBe(false);
    expect(testId(wrapper, "onboarding-invitation-note").text()).toBe(
      "onboarding.steps.home_assistant.optional",
    );
    wrapper.unmount();
  });

  it("starts the Home Assistant setup flow from Connect", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    // another plugin says nothing about Home Assistant
    onboardingState.plugins.value = [configured("spotify_connect")];
    const wrapper = mountStep();

    expect(
      wrapper
        .find("[data-testid=onboarding-home-assistant-connection]")
        .exists(),
    ).toBe(false);
    primaryAction(wrapper)?.run();

    expect(emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "provider",
      domain: "hass",
    });
    wrapper.unmount();
  });

  it("shows the connection once it is set up, instead of Connect", () => {
    onboardingState.plugins.value = [
      configured("hass", { name: "Home Assistant" }),
    ];
    const wrapper = mountStep();

    const connection = wrapper.find(
      "[data-testid=onboarding-home-assistant-connection]",
    );
    expect(connection.text()).toBe("Home Assistant");
    expect(connection.find("[aria-label]").exists()).toBe(false);
    expect(primaryAction(wrapper)).toBeUndefined();
    // set up, so there is nothing left to invite to or leave for later
    expect(testId(wrapper, "onboarding-invitation-features").exists()).toBe(
      false,
    );
    expect(testId(wrapper, "onboarding-invitation-note").exists()).toBe(false);
    wrapper.unmount();
  });

  it("flags a connection that is set up but does not work", () => {
    onboardingState.plugins.value = [
      configured("hass", {
        needsAttention: true,
        status: ProviderStatus.AUTH_REQUIRED,
      }),
    ];
    const wrapper = mountStep();

    expect(
      wrapper
        .find("[data-testid=onboarding-home-assistant-connection] [aria-label]")
        .attributes("aria-label"),
    ).toBe("settings.provider_status_auth_required");
    wrapper.unmount();
  });

  it("offers to reconfigure a connection that has to sign in again", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    apiMock.providerManifests.hass = { has_setup_flow: true };
    onboardingState.plugins.value = [
      configured("hass", {
        name: "Home Assistant",
        needsAttention: true,
        status: ProviderStatus.AUTH_REQUIRED,
      }),
    ];
    const wrapper = mountStep();

    await wrapper
      .find(
        "[data-testid=onboarding-home-assistant-connection] [data-testid=onboarding-provider-reconfigure]",
      )
      .trigger("click");

    expect(emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "hass--1",
      name: "Home Assistant",
    });
    wrapper.unmount();
  });
});
