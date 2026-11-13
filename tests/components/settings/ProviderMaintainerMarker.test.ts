import ProviderMaintainerMarker from "@/components/settings/providers/ProviderMaintainerMarker.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { i18nMock } = vi.hoisted(() => ({
  // a spy that returns the key, so the interpolation arguments stay assertable
  i18nMock: { t: vi.fn((key: string) => key) },
}));

vi.mock("@/plugins/i18n", () => ({ $t: i18nMock.t }));

enableAutoUnmount(afterEach);

describe("ProviderMaintainerMarker", () => {
  it("labels the icon without naming the maintainers", () => {
    const wrapper = mount(ProviderMaintainerMarker, {
      props: { variant: "icon", maintainers: ["@jane"] },
    });

    const marker = wrapper.get('[data-testid="community-marker"]');
    expect(marker.attributes("role")).toBe("img");
    expect(marker.attributes("aria-label")).toBe(
      "settings.provider_community_maintained",
    );
    expect(marker.find('[data-slot="badge"]').exists()).toBe(false);
  });

  it("names the maintainers after the badge on the line of a community provider", () => {
    const wrapper = mount(ProviderMaintainerMarker, {
      props: {
        variant: "line",
        community: true,
        maintainers: ["@jane", "@john"],
      },
    });

    const marker = wrapper.get('[data-testid="provider-maintainers"]');
    expect(marker.get('[data-slot="badge"]').text()).toBe(
      "settings.provider_community",
    );
    expect(marker.findAll(":scope > *").map((el) => el.text())).toEqual([
      "settings.provider_community",
      "settings.provider_maintained_by",
    ]);
    expect(i18nMock.t).toHaveBeenCalledWith("settings.provider_maintained_by", {
      maintainers: "@jane, @john",
    });
  });

  it("names the maintainers without a badge on the line of a core provider", () => {
    const wrapper = mount(ProviderMaintainerMarker, {
      props: { variant: "line", maintainers: ["@jane"] },
    });

    const marker = wrapper.get('[data-testid="provider-maintainers"]');
    expect(marker.find('[data-slot="badge"]').exists()).toBe(false);
    expect(marker.text()).toBe("settings.provider_maintained_by");
    expect(i18nMock.t).toHaveBeenCalledWith("settings.provider_maintained_by", {
      maintainers: "@jane",
    });
  });

  it.each([[[]], [undefined]])(
    "shows only the badge without maintainers (%j)",
    (maintainers) => {
      const wrapper = mount(ProviderMaintainerMarker, {
        props: { variant: "line", community: true, maintainers },
      });

      expect(wrapper.get('[data-testid="provider-maintainers"]').text()).toBe(
        "settings.provider_community",
      );
    },
  );
});
