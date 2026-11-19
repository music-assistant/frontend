import ProvidersStep from "@/components/onboarding/steps/ProvidersStep.vue";
import type { ConfiguredProvider } from "@/composables/useOnboarding";
import { ProviderStatus, ProviderType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, onboardingState } = vi.hoisted(() => ({
  apiMock: {
    providerManifests: {} as Record<string, { has_setup_flow: boolean }>,
  },
  // what the composable found, which the step only ever reads
  onboardingState: {
    musicSources: [] as ConfiguredProvider[],
    apps: [] as ConfiguredProvider[],
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/composables/useOnboarding", () => ({
  configuredProviders: (type: ProviderType) =>
    type === ProviderType.MUSIC ? onboardingState.musicSources : [],
  configuredAudioSourcePlugins: () => onboardingState.apps,
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the icon reaches for artwork and a theme this bare mount does not set up
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<i />",
  },
}));

// the dialog is covered where it lives; here it only has to be reachable and
// to report the props the step hands it
vi.mock("@/views/settings/AddProviderDialog.vue", () => ({
  default: {
    name: "AddProviderDialog",
    props: { show: Boolean, providerType: String, audioSourceOnly: Boolean },
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

function mountStep(providerType: ProviderType) {
  return mount(ProvidersStep, {
    props: { providerType },
    global: { mocks: { $t: (key: string) => key } },
  });
}

type Wrapper = ReturnType<typeof mountStep>;

function testId(wrapper: Wrapper, id: string) {
  return wrapper.find(`[data-testid=${id}]`);
}

const features = (wrapper: Wrapper) =>
  testId(wrapper, "onboarding-invitation-features")
    .findAll("li")
    .map((item) => item.text());
const linked = (wrapper: Wrapper) =>
  testId(wrapper, "onboarding-invitation-visual").attributes("data-linked");
const addButton = (wrapper: Wrapper) =>
  testId(wrapper, "onboarding-add-provider");

describe("ProvidersStep", () => {
  beforeEach(() => {
    onboardingState.musicSources = [];
    onboardingState.apps = [];
    apiMock.providerManifests = {};
  });

  describe("for the music sources", () => {
    it("invites to add one while none is set up", () => {
      const wrapper = mountStep(ProviderType.MUSIC);

      expect(testId(wrapper, "onboarding-invitation-intro").text()).toBe(
        "onboarding.steps.music_sources.description",
      );
      expect(features(wrapper)).toEqual([
        "onboarding.steps.music_sources.features.streaming",
        "onboarding.steps.music_sources.features.files",
        "onboarding.steps.music_sources.features.radio",
      ]);
      expect(addButton(wrapper).text()).toBe("settings.add_music_provider");
      expect(addButton(wrapper).classes()).toEqual(
        expect.arrayContaining(["self-center", "bg-primary", "h-10"]),
      );
      // the step is not optional, so nothing says it can wait
      expect(testId(wrapper, "onboarding-invitation-optional").exists()).toBe(
        false,
      );
      expect(linked(wrapper)).toBeUndefined();

      wrapper.unmount();
    });

    it("lists the sources set up, with a way to add another", () => {
      onboardingState.musicSources = [
        configured("spotify", { name: "Spotify" }),
      ];

      const wrapper = mountStep(ProviderType.MUSIC);

      expect(
        wrapper
          .findAll("[data-testid=onboarding-configured-provider]")
          .map((row) => row.text()),
      ).toEqual(["Spotify"]);
      expect(testId(wrapper, "onboarding-invitation-features").exists()).toBe(
        false,
      );
      expect(addButton(wrapper).classes()).toContain("bg-accent");
      expect(linked(wrapper)).toBe("true");

      wrapper.unmount();
    });

    it("leaves the link unmade while no source works", () => {
      onboardingState.musicSources = [
        configured("spotify", {
          needsAttention: true,
          status: ProviderStatus.AUTH_REQUIRED,
        }),
      ];

      const wrapper = mountStep(ProviderType.MUSIC);

      expect(linked(wrapper)).toBeUndefined();

      wrapper.unmount();
    });

    it("opens the add dialog on the music providers", async () => {
      const wrapper = mountStep(ProviderType.MUSIC);
      const dialog = wrapper.findComponent({ name: "AddProviderDialog" });

      await addButton(wrapper).trigger("click");

      expect(dialog.props()).toMatchObject({
        show: true,
        providerType: ProviderType.MUSIC,
        audioSourceOnly: false,
      });

      wrapper.unmount();
    });
  });

  describe("for the music apps", () => {
    it("invites to connect one while none is set up", () => {
      const wrapper = mountStep(ProviderType.PLUGIN);

      expect(testId(wrapper, "onboarding-invitation-intro").text()).toBe(
        "onboarding.steps.plugins.phone_apps_instructions",
      );
      expect(features(wrapper)).toEqual([
        "onboarding.steps.plugins.features.apps",
        "onboarding.steps.plugins.features.spotify_connect",
        "onboarding.steps.plugins.features.airplay",
      ]);
      expect(addButton(wrapper).text()).toBe(
        "onboarding.steps.plugins.connect",
      );
      expect(addButton(wrapper).classes()).toContain("h-10");

      wrapper.unmount();
    });

    it("lists the apps connected, and only those", () => {
      onboardingState.musicSources = [configured("spotify")];
      onboardingState.apps = [
        configured("spotify_connect", { name: "Spotify Connect" }),
      ];

      const wrapper = mountStep(ProviderType.PLUGIN);

      expect(
        wrapper
          .findAll("[data-testid=onboarding-configured-provider]")
          .map((row) => row.text()),
      ).toEqual(["Spotify Connect"]);

      wrapper.unmount();
    });

    it("opens the add dialog on the apps that play to Music Assistant", async () => {
      const wrapper = mountStep(ProviderType.PLUGIN);
      const dialog = wrapper.findComponent({ name: "AddProviderDialog" });

      await addButton(wrapper).trigger("click");

      expect(dialog.props()).toMatchObject({
        show: true,
        providerType: ProviderType.PLUGIN,
        audioSourceOnly: true,
      });

      wrapper.unmount();
    });
  });
});
