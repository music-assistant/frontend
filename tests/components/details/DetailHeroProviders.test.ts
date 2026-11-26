import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockMappedServices, screen } = vi.hoisted(() => ({
  mockMappedServices: vi.fn(),
  screen: { isPhone: false },
}));

vi.mock("@/plugins/breakpoint", () => ({
  isPhoneSizedScreen: () => screen.isPhone,
}));

vi.mock("@/plugins/api/helpers", () => ({
  mappedServices: mockMappedServices,
}));

// the real utils module pulls in the api client
vi.mock("@/helpers/utils", () => ({
  isWebUrl: (url?: string) => /^https?:\/\//.test(url ?? ""),
}));

// the real icon reaches for the theme and the provider icon cache; the pill only
// needs to know one was rendered per service
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: '<i class="provider-icon-stub" :data-domain="domain" />',
  },
}));

import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import type { MediaItem } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { artist } from "../../fixtures/artist";

function mountProviders(
  services: Array<{ domain: string; name: string; url?: string }>,
) {
  mockMappedServices.mockReturnValue(services);
  return mount(DetailHeroProviders, {
    props: { item: artist() as MediaItem },
  });
}

describe("DetailHeroProviders", () => {
  beforeEach(() => {
    screen.isPhone = false;
  });

  it("shows a name and an icon per service, separated only between them", () => {
    const wrapper = mountProviders([
      { domain: "tidal", name: "Tidal" },
      { domain: "qobuz", name: "Qobuz" },
    ]);

    expect(
      wrapper.findAll(".detail-hero-providers__name").map((n) => n.text()),
    ).toEqual(["Tidal", "Qobuz"]);
    expect(wrapper.findAll(".provider-icon-stub")).toHaveLength(2);
    // one separator, between the two, never before the first
    expect(wrapper.findAll(".detail-hero-providers__sep")).toHaveLength(1);
  });

  it("opens a service's page for the item in a new tab", () => {
    const wrapper = mountProviders([
      { domain: "tidal", name: "Tidal", url: "https://tidal.com/artist/1" },
    ]);

    const link = wrapper.get("a.detail-hero-providers__service");
    expect(link.attributes("href")).toBe("https://tidal.com/artist/1");
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toBe("noopener noreferrer");
    expect(link.attributes("aria-label")).toBe("Tidal");
  });

  it("does not link a service without a web page", () => {
    const wrapper = mountProviders([
      { domain: "spotify", name: "Spotify" },
      { domain: "filesystem_local", name: "Local files", url: "ZZ Top" },
    ]);

    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.findAll(".detail-hero-providers__service")).toHaveLength(2);
  });

  it("renders nothing when the item has no known services", () => {
    const wrapper = mountProviders([]);

    expect(wrapper.find(".detail-hero-providers").exists()).toBe(false);
  });

  it("leaves the services out of a phone's header", () => {
    screen.isPhone = true;
    const wrapper = mountProviders([{ domain: "tidal", name: "Tidal" }]);

    expect(wrapper.find(".provider-icon-stub").exists()).toBe(false);
  });
});
