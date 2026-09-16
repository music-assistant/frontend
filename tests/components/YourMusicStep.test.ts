// Imported once, outside any test: pulling the empty and item components in is
// the expensive part, and the import phase is not on a test's clock.
import YourMusicStep from "@/components/onboarding/steps/YourMusicStep.vue";
import { ProviderType, type ProviderInstance } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, ProviderInstance>,
    providerManifests: {} as Record<string, { builtin: boolean; name: string }>,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

// the icon reaches for artwork and a theme this bare mount does not set up;
// what it stands for is covered where it lives
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<i />",
  },
}));

function addSource(instanceId: string, name: string, builtin = false) {
  const domain = instanceId.split("--")[0];
  apiMock.providers[instanceId] = {
    instance_id: instanceId,
    domain,
    name,
    type: ProviderType.MUSIC,
    supported_features: [],
    available: true,
    is_streaming_provider: null,
  };
  apiMock.providerManifests[domain] = { builtin, name: `${domain} manifest` };
}

function mountStep() {
  return mount(YourMusicStep, {
    global: {
      mocks: {
        // echo the count back, so a test can tell which number it was given
        $t: (key: string, params?: Record<string, unknown>) =>
          params?.count != null ? `${key}:${params.count}` : key,
      },
    },
  });
}

function names(wrapper: ReturnType<typeof mountStep>) {
  return wrapper
    .findAll("[data-testid=onboarding-music-source]")
    .map((row) => row.text());
}

describe("YourMusicStep", () => {
  beforeEach(() => {
    apiMock.providers = {};
    apiMock.providerManifests = {};
  });

  it("names the music the member can listen to", () => {
    addSource("spotify--1", "Spotify");
    addSource("filesystem--1", "Our music");
    // the server ships this one: nobody here chose it
    addSource("builtin--1", "Builtin", true);

    const wrapper = mountStep();

    expect(names(wrapper)).toEqual(["Our music", "Spotify"]);
    expect(wrapper.find("[data-testid=onboarding-more-sources]").exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it("leaves out a source that is not there to listen to right now", () => {
    addSource("spotify--1", "Spotify");
    addSource("subsonic--1", "Subsonic");
    apiMock.providers["subsonic--1"].available = false;

    const wrapper = mountStep();

    // a source that failed to load plays nothing; the admin hears about it on
    // the settings page, and the member is not pointed at something broken
    expect(names(wrapper)).toEqual(["Spotify"]);

    wrapper.unmount();
  });

  it("leaves the source icons to the names beside them", () => {
    addSource("spotify--1", "Spotify");

    const wrapper = mountStep();

    // the row already says which source it is
    expect(
      wrapper.findComponent({ name: "ProviderIcon" }).attributes("aria-hidden"),
    ).toBe("true");

    wrapper.unmount();
  });

  it("counts the sources it does not name", () => {
    for (let index = 0; index < 8; index++) {
      addSource(`provider-${index}--1`, `Source ${index}`);
    }

    const wrapper = mountStep();

    expect(names(wrapper)).toHaveLength(6);
    expect(wrapper.find("[data-testid=onboarding-more-sources]").text()).toBe(
      "onboarding.more_count:2",
    );

    wrapper.unmount();
  });

  it("says so when there is nothing to listen to yet", () => {
    const wrapper = mountStep();

    expect(names(wrapper)).toEqual([]);
    expect(wrapper.text()).toContain("onboarding.steps.your_music.empty");

    wrapper.unmount();
  });

  it("offers nothing that leaves the onboarding", () => {
    addSource("spotify--1", "Spotify");

    const wrapper = mountStep();

    // browsing the music is the tour's to show afterwards: the step is a look
    // at what is here, with no button or link to walk out through
    expect(wrapper.findAll("button, a")).toHaveLength(0);

    wrapper.unmount();
  });
});
