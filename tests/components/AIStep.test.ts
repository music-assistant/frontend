import AIStep from "@/components/onboarding/steps/AIStep.vue";
import type { ConfiguredProvider } from "@/composables/useOnboarding";
import {
  type AIEngine,
  AIEngineKind,
  ProviderStatus,
  ProviderType,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, onboardingState } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, { has_setup_flow: boolean }>,
    getAIEngines: vi.fn(),
    getAIUsage: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
  // replaced with a real ref by the useOnboarding mock factory below, so the
  // step shows whatever a test says is set up
  onboardingState: {
    services: { value: [] as ConfiguredProvider[] },
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: () => true } }));

vi.mock("@/composables/useOnboarding", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  onboardingState.services = ref<ConfiguredProvider[]>([]);
  return { configuredAIServices: () => onboardingState.services.value };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the dialog is covered where it lives; here it only has to be reachable
vi.mock("@/views/settings/AddProviderDialog.vue", () => ({
  default: {
    name: "AddProviderDialog",
    // typed like the dialog's own, so a bare attribute reads as a boolean
    props: { show: Boolean, providerType: String, aiServiceOnly: Boolean },
    template: "<div />",
  },
}));

// the icon reaches for artwork and a theme this bare mount does not set up
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<i />",
  },
}));

// the settings dialog is covered where it lives; here it only has to say
// whether the row opened it
vi.mock("@/components/settings/providers/ProviderSettingsDialog.vue", () => ({
  default: {
    name: "ProviderSettingsDialog",
    props: { open: Boolean, instanceId: String },
    template: "<div />",
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

function engine(uid: string, kind: AIEngineKind, provider: string): AIEngine {
  return { uid, name: uid, kind, provider };
}

async function mountStep() {
  const wrapper = mount(AIStep, {
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountStep>>;

function testId(wrapper: Wrapper, id: string) {
  return wrapper.find(`[data-testid=${id}]`);
}

const linked = (wrapper: Wrapper) =>
  testId(wrapper, "onboarding-invitation-visual").attributes("data-linked");

describe("AIStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onboardingState.services.value = [];
    apiMock.providerManifests = {};
    apiMock.getAIEngines.mockResolvedValue([]);
    apiMock.getAIUsage.mockResolvedValue([]);
  });

  it("lists a few examples of what AI brings", async () => {
    const wrapper = await mountStep();

    expect(testId(wrapper, "onboarding-invitation-intro").text()).toBe(
      "onboarding.steps.ai.intro",
    );
    // a selection: more of Music Assistant uses AI over time
    expect(testId(wrapper, "onboarding-invitation-features-title").text()).toBe(
      "onboarding.steps.ai.examples",
    );
    expect(
      testId(wrapper, "onboarding-invitation-features")
        .findAll("li")
        .map((item) => item.text()),
    ).toEqual([
      "onboarding.steps.ai.features.announcements",
      "onboarding.steps.ai.features.ai_radio",
      "onboarding.steps.ai.features.smart_playlists",
      "onboarding.steps.ai.features.music_quiz",
      "onboarding.steps.ai.features.playlist_covers",
    ]);
  });

  it("lists the AI services set up, each with what it provides", async () => {
    onboardingState.services.value = [
      configured("openai_compatible", { name: "OpenAI" }),
      configured("hass", { name: "Home Assistant" }),
    ];
    apiMock.getAIEngines.mockResolvedValue([
      engine("gpt", AIEngineKind.TEXT, "openai_compatible--1"),
      engine("dall-e", AIEngineKind.IMAGE, "openai_compatible--1"),
      engine("piper", AIEngineKind.SPEECH, "hass--1"),
    ]);

    const wrapper = await mountStep();

    expect(
      wrapper
        .findAll("[data-testid=onboarding-ai-service]")
        .map((item) => item.text()),
    ).toEqual([
      "OpenAIsettings.ai.engine_count.text · settings.ai.engine_count.image",
      "Home Assistantsettings.ai.engine_count.speech",
    ]);
    // set up, so the link is made and nothing is left to invite to
    expect(linked(wrapper)).toBe("true");
    expect(testId(wrapper, "onboarding-invitation-features").exists()).toBe(
      false,
    );
    expect(testId(wrapper, "onboarding-invitation-optional").exists()).toBe(
      false,
    );
    // a way to add another, without the weight of the first invitation
    const add = wrapper.get("[data-testid=onboarding-add-ai-service]");
    expect(add.text()).toBe("settings.ai.add_service");
    expect(add.classes()).toContain("bg-accent");
  });

  it("shows a working service for its status, without opening its settings", async () => {
    onboardingState.services.value = [
      configured("hass", { name: "Home Assistant" }),
    ];

    const wrapper = await mountStep();

    const service = wrapper.get("[data-testid=onboarding-ai-service]");
    expect(service.element.tagName).not.toBe("BUTTON");
    await service.trigger("click");
    expect(
      wrapper.findComponent({ name: "ProviderSettingsDialog" }).exists(),
    ).toBe(false);
  });

  it("flags a service that is set up but does not work", async () => {
    onboardingState.services.value = [
      configured("openai_compatible", {
        name: "OpenAI",
        needsAttention: true,
        status: ProviderStatus.AUTH_REQUIRED,
      }),
    ];

    const wrapper = await mountStep();

    const service = wrapper.get("[data-testid=onboarding-ai-service]");
    expect(service.text()).toBe("OpenAI");
    expect(service.find("[aria-label]").attributes("aria-label")).toBe(
      "settings.provider_status_auth_required",
    );
    expect(linked(wrapper)).toBeUndefined();
  });

  it("keeps Reconfigure on a service that has to sign in again", async () => {
    apiMock.providerManifests = { openai_compatible: { has_setup_flow: true } };
    onboardingState.services.value = [
      configured("openai_compatible", {
        name: "OpenAI",
        needsAttention: true,
        status: ProviderStatus.AUTH_REQUIRED,
      }),
    ];

    const wrapper = await mountStep();

    expect(
      wrapper
        .get("[data-testid=onboarding-ai-service]")
        .find("[data-testid=onboarding-provider-reconfigure]")
        .exists(),
    ).toBe(true);
  });

  it("invites to add an AI service while none is set up, as optional", async () => {
    const wrapper = await mountStep();

    expect(wrapper.find("[data-testid=onboarding-ai-service]").exists()).toBe(
      false,
    );
    const add = wrapper.get("[data-testid=onboarding-add-ai-service]");
    expect(add.text()).toBe("settings.ai.add_service");
    expect(add.classes()).toEqual(
      expect.arrayContaining(["self-center", "bg-primary", "h-10"]),
    );
    expect(testId(wrapper, "onboarding-invitation-optional").text()).toBe(
      "onboarding.steps.ai.optional",
    );
    expect(linked(wrapper)).toBeUndefined();
  });

  it("opens the add flow on the AI and speech services", async () => {
    const wrapper = await mountStep();
    const dialog = wrapper.findComponent({ name: "AddProviderDialog" });
    expect(dialog.props("show")).toBe(false);

    await wrapper
      .get("[data-testid=onboarding-add-ai-service]")
      .trigger("click");

    expect(dialog.props()).toMatchObject({
      show: true,
      providerType: ProviderType.PLUGIN,
      aiServiceOnly: true,
    });
  });
});
