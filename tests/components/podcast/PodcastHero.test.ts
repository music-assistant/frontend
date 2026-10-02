import PodcastHero from "@/components/podcast/PodcastHero.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { podcast } from "../../fixtures/podcast";
import { providerMapping } from "../../fixtures/providerMapping";

vi.mock("@/plugins/api", () => ({ api: {} }));
vi.mock("@/plugins/breakpoint", () => ({ isPhoneSizedScreen: () => false }));
vi.mock("@/components/details/DetailHero.vue", () => ({
  default: { template: '<div><slot name="main" /></div>' },
}));
vi.mock("@/components/details/DetailHeroFavorite.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroGenres.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroPlayButton.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroProviders.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<div />",
  },
}));

function mountHero(item: ReturnType<typeof podcast>) {
  return mount(PodcastHero, {
    props: { item },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("PodcastHero", () => {
  it("badges a podcast in the library", () => {
    const wrapper = mountHero(
      podcast({
        provider_mappings: [
          providerMapping({ provider_domain: "rss", in_library: true }),
        ],
      }),
    );

    const badge = wrapper.find(".podcast-hero__badge");
    expect(badge.attributes("aria-label")).toBe("in_library");
    expect(
      wrapper.findComponent({ name: "ProviderIcon" }).props("domain"),
    ).toBe("library");
  });

  it("leaves the badge off a podcast outside the library", () => {
    const wrapper = mountHero(
      podcast({
        provider: "rss",
        provider_mappings: [providerMapping({ provider_domain: "rss" })],
      }),
    );

    expect(wrapper.find(".podcast-hero__badge").exists()).toBe(false);
  });
});
