import ProvidersStep from "@/components/onboarding/steps/ProvidersStep.vue";
import type { ConfiguredProvider } from "@/composables/useOnboarding";
import type { StepPrimaryAction } from "@/helpers/onboarding";
import { ProviderStatus, ProviderType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";

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

// the settings dialog is covered where it lives; here it only has to say
// whether the row opened it
vi.mock("@/components/settings/providers/ProviderSettingsDialog.vue", () => ({
  default: {
    name: "ProviderSettingsDialog",
    props: { open: Boolean, instanceId: String },
    template: "<div />",
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
const addRow = (wrapper: Wrapper) => testId(wrapper, "onboarding-add-provider");
// the step's own way forward, which the wizard shows as its main button
const primaryAction = (wrapper: Wrapper) =>
  (wrapper.vm as unknown as { primaryAction?: StepPrimaryAction })
    .primaryAction;

describe("ProvidersStep", () => {
  beforeEach(() => {
    onboardingState.musicSources = [];
    onboardingState.apps = [];
    apiMock.providerManifests = {};
  });

  describe("for the music sources", () => {
    it("invites to add one while none is set up", () => {
      const wrapper = mountStep(ProviderType.MUSIC);

      expect(features(wrapper)).toEqual([
        "onboarding.steps.music_sources.features.streaming",
        "onboarding.steps.music_sources.features.files",
        "onboarding.steps.music_sources.features.radio",
      ]);
      expect(primaryAction(wrapper)?.labelKey).toBe(
        "settings.add_music_provider",
      );
      // the wizard's footer holds it, so the step has no button of its own
      expect(addRow(wrapper).exists()).toBe(false);
      // the step is not optional, so nothing says it can wait
      expect(testId(wrapper, "onboarding-invitation-note").exists()).toBe(
        false,
      );

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
      expect(addRow(wrapper).text()).toBe("settings.add_music_provider");
      expect(primaryAction(wrapper)).toBeUndefined();

      wrapper.unmount();
    });

    it("opens the whole list when a source is added past the first five", async () => {
      const sources = reactive(
        ["a", "b", "c", "d", "e"].map((domain) => configured(domain)),
      );
      onboardingState.musicSources = sources;
      const wrapper = mountStep(ProviderType.MUSIC);

      sources.push(configured("spotify", { name: "Spotify" }));
      await nextTick();

      expect(
        wrapper
          .findAll("[data-testid=onboarding-configured-provider]")
          .map((row) => row.text()),
      ).toContain("Spotify");

      wrapper.unmount();
    });

    it("offers no show all for a short list, even after adding one", async () => {
      const sources = reactive<ConfiguredProvider[]>([]);
      onboardingState.musicSources = sources;
      const wrapper = mountStep(ProviderType.MUSIC);

      sources.push(configured("spotify", { name: "Spotify" }));
      await nextTick();

      expect(testId(wrapper, "onboarding-show-all-providers").exists()).toBe(
        false,
      );

      wrapper.unmount();
    });

    it("lists a source that does not work, with what is wrong", () => {
      onboardingState.musicSources = [
        configured("spotify", {
          needsAttention: true,
          status: ProviderStatus.AUTH_REQUIRED,
        }),
      ];

      const wrapper = mountStep(ProviderType.MUSIC);

      expect(
        wrapper
          .get("[data-testid=onboarding-configured-provider] [aria-label]")
          .attributes("aria-label"),
      ).toBe("settings.provider_status_auth_required");

      wrapper.unmount();
    });

    it("opens the add dialog on the music providers", async () => {
      const wrapper = mountStep(ProviderType.MUSIC);
      const dialog = wrapper.findComponent({ name: "AddProviderDialog" });

      primaryAction(wrapper)?.run();
      await flushPromises();

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

      expect(features(wrapper)).toEqual([
        "onboarding.steps.plugins.features.apps",
        "onboarding.steps.plugins.features.spotify_connect",
        "onboarding.steps.plugins.features.airplay",
      ]);
      expect(primaryAction(wrapper)?.labelKey).toBe(
        "onboarding.steps.plugins.connect",
      );

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

    it("opens a connected app's settings from its row", async () => {
      onboardingState.apps = [
        configured("spotify_connect", { name: "Spotify Connect" }),
      ];

      const wrapper = mountStep(ProviderType.PLUGIN);

      const row = wrapper.get("[data-testid=onboarding-configured-provider]");
      expect(row.element.tagName).toBe("BUTTON");
      await row.trigger("click");
      expect(
        wrapper.findComponent({ name: "ProviderSettingsDialog" }).props(),
      ).toMatchObject({ open: true, instanceId: "spotify_connect--1" });

      wrapper.unmount();
    });

    it("opens the add dialog on the apps that play to Music Assistant", async () => {
      const wrapper = mountStep(ProviderType.PLUGIN);
      const dialog = wrapper.findComponent({ name: "AddProviderDialog" });

      primaryAction(wrapper)?.run();
      await flushPromises();

      expect(dialog.props()).toMatchObject({
        show: true,
        providerType: ProviderType.PLUGIN,
        audioSourceOnly: true,
      });

      wrapper.unmount();
    });
  });
});
