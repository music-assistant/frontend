// Imported once, outside any test: pulling the empty, item and dialog
// components in is the expensive part, and the import phase is not on a test's
// clock.
import OwnSourcesStep from "@/components/onboarding/steps/OwnSourcesStep.vue";
import {
  ProviderSharing,
  ProviderType,
  type ProviderConfig,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../fixtures/providerConfig";

const { apiMock, onboardingState } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, ProviderInstance>,
    providerManifests: {} as Record<string, { name: string }>,
  },
  // replaced with a real ref by the useOnboarding mock factory below, so the
  // step lists whatever a test says this member owns
  onboardingState: {
    ownedMusicSources: { value: [] as ProviderConfig[] },
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/composables/useOnboarding", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  onboardingState.ownedMusicSources = ref<ProviderConfig[]>([]);
  return {
    useOnboarding: () => ({
      ownedMusicSources: onboardingState.ownedMusicSources,
    }),
  };
});

// the icon reaches for artwork and a theme this bare mount does not set up;
// what it stands for is covered where it lives
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
    props: ["show", "providerType", "multiInstanceOnly", "selfServiceOnly"],
    template: "<div data-testid='add-provider-dialog' />",
  },
}));

function ownSource(instanceId: string, domain: string, name: string | null) {
  onboardingState.ownedMusicSources.value.push(
    providerConfig({
      instance_id: instanceId,
      domain,
      type: ProviderType.MUSIC,
      name,
      access: {
        owner: "sam-1",
        sharing: ProviderSharing.PRIVATE,
        shared_users: [],
      },
    }),
  );
  apiMock.providerManifests[domain] = { name: `${domain} manifest` };
}

function mountStep() {
  return mount(OwnSourcesStep, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("OwnSourcesStep", () => {
  beforeEach(() => {
    apiMock.providers = {};
    apiMock.providerManifests = {};
    onboardingState.ownedMusicSources.value = [];
  });

  it("invites the member to connect a source when they own none", () => {
    const wrapper = mountStep();

    expect(wrapper.text()).toContain("onboarding.steps.own_sources.empty");
    expect(wrapper.findAll("[data-testid=onboarding-own-source]")).toHaveLength(
      0,
    );
    // the add button is still there to act on the invitation
    expect(wrapper.find("[data-testid=onboarding-add-provider]").exists()).toBe(
      true,
    );

    wrapper.unmount();
  });

  it("lists the sources the member already owns", () => {
    ownSource("spotify--1", "spotify", "Sam's Spotify");
    // no custom name: the source falls back on its manifest name
    ownSource("tidal--1", "tidal", null);

    const wrapper = mountStep();

    expect(
      wrapper
        .findAll("[data-testid=onboarding-own-source]")
        .map((row) => row.text()),
    ).toEqual(["Sam's Spotify", "tidal manifest"]);
    expect(wrapper.text()).toContain("onboarding.steps.own_sources.connected");
    expect(wrapper.text()).not.toContain("onboarding.steps.own_sources.empty");

    wrapper.unmount();
  });

  it("opens the add-a-source dialog in self-service music mode", async () => {
    const wrapper = mountStep();

    // the dialog stays unmounted until opened, so it never fetches the
    // provider configs the wizard has already loaded
    expect(wrapper.findComponent({ name: "AddProviderDialog" }).exists()).toBe(
      false,
    );

    await wrapper
      .find("[data-testid=onboarding-add-provider]")
      .trigger("click");

    const dialog = wrapper.findComponent({ name: "AddProviderDialog" });
    expect(dialog.props("show")).toBe(true);
    // a member only ever adds a music source of their own, self-service and
    // multi-instance, exactly as the settings page offers it
    expect(dialog.props("providerType")).toBe(ProviderType.MUSIC);
    expect(dialog.props("multiInstanceOnly")).toBe(true);
    expect(dialog.props("selfServiceOnly")).toBe(true);

    wrapper.unmount();
  });
});
