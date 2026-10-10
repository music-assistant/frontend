import { describe, expect, it, vi } from "vitest";

const { mockMappedServices } = vi.hoisted(() => ({
  mockMappedServices: vi.fn(),
}));

vi.mock("@/plugins/api/helpers", () => ({
  mappedServices: mockMappedServices,
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

function mountProviders(services: Array<{ domain: string; name: string }>) {
  mockMappedServices.mockReturnValue(services);
  return mount(DetailHeroProviders, {
    props: { item: artist() as MediaItem },
  });
}

describe("DetailHeroProviders", () => {
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

  it("renders nothing when the item has no known services", () => {
    const wrapper = mountProviders([]);

    expect(wrapper.find(".detail-hero-providers").exists()).toBe(false);
  });
});
