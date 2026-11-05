import CommunityProviderMarker from "@/components/settings/providers/CommunityProviderMarker.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { i18nMock } = vi.hoisted(() => ({
  // a spy that returns the key, so the interpolation arguments stay assertable
  i18nMock: { t: vi.fn((key: string) => key) },
}));

vi.mock("@/plugins/i18n", () => ({ $t: i18nMock.t }));

enableAutoUnmount(afterEach);

describe("CommunityProviderMarker", () => {
  it("labels the icon without naming the maintainers", () => {
    const wrapper = mount(CommunityProviderMarker, {
      props: { variant: "icon", maintainers: ["@jane"] },
    });

    const marker = wrapper.get('[data-testid="community-marker"]');
    expect(marker.attributes("role")).toBe("img");
    expect(marker.attributes("aria-label")).toBe(
      "settings.provider_community_maintained",
    );
  });

  it("names the maintainers on the line", () => {
    const wrapper = mount(CommunityProviderMarker, {
      props: { variant: "line", maintainers: ["@jane", "@john"] },
    });

    expect(wrapper.get('[data-testid="community-marker"]').text()).toBe(
      "settings.provider_community_maintained_by",
    );
    expect(i18nMock.t).toHaveBeenCalledWith(
      "settings.provider_community_maintained_by",
      { maintainers: "@jane, @john" },
    );
  });

  it.each([[[]], [undefined]])(
    "falls back to the bare line without maintainers (%j)",
    (maintainers) => {
      const wrapper = mount(CommunityProviderMarker, {
        props: { variant: "line", maintainers },
      });

      expect(wrapper.get('[data-testid="community-marker"]').text()).toBe(
        "settings.provider_community_maintained",
      );
    },
  );
});
