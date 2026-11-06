import AlbumHero from "@/components/album/AlbumHero.vue";
import ExplicitBadge from "@/components/details/ExplicitBadge.vue";
import ExplicitIcon from "@/components/icons/ExplicitIcon.vue";
import TrackHero from "@/components/track/TrackHero.vue";
import { mount, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { album } from "../../fixtures/album";
import { track } from "../../fixtures/track";

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/api", () => ({ api: {} }));
vi.mock("@/plugins/store", () => ({ store: {} }));
vi.mock("@/plugins/breakpoint", () => ({
  isPhoneSizedScreen: () => false,
}));
vi.mock("@/helpers/radio", () => ({
  gotoRadio: vi.fn(),
  radioRelevant: () => false,
  radioSupported: () => false,
}));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/layouts/default/ItemContextMenu.vue", () => ({
  getContextMenuItems: vi.fn(() => Promise.resolve([])),
}));

describe("ExplicitBadge", () => {
  it.each([false, true])(
    "uses the shared SVG with the existing small size and accessible label (overlay: %s)",
    (overlay) => {
      const wrapper = mount(ExplicitBadge, { props: { overlay } });
      expect(wrapper.classes()).toContain("size-4");
      expect(wrapper.classes().includes("explicit-badge--overlay")).toBe(
        overlay,
      );
      expect(wrapper.attributes("role")).toBe("img");
      expect(wrapper.attributes("aria-label")).toBe("tooltip.explicit");
      expect(wrapper.attributes("title")).toBe("tooltip.explicit");
      const icon = wrapper.getComponent(ExplicitIcon);
      expect(icon.attributes("aria-hidden")).toBe("true");
      expect(icon.attributes("viewBox")).toBe("2 2 20 20");
      expect(icon.classes()).toContain("size-4");
      expect(icon.get("rect").attributes("width")).toBe("20");
      expect(icon.get("text").text()).toBe("E");
    },
  );

  it.each([true, false, undefined])(
    "uses the same badge in album and track heroes for explicit content (%s)",
    (explicit) => {
      const global = {
        stubs: {
          DetailHero: { template: '<div><slot name="main" /></div>' },
          ExplicitBadge: false,
          ExplicitIcon: false,
        },
      };
      const wrappers = [
        shallowMount(AlbumHero, {
          props: { item: album({ metadata: { explicit } }) },
          global,
        }),
        shallowMount(TrackHero, {
          props: { item: track({ metadata: { explicit } }) },
          global,
        }),
      ];
      for (const wrapper of wrappers) {
        expect(wrapper.findComponent(ExplicitBadge).exists()).toBe(
          explicit === true,
        );
        if (explicit === true) {
          const badge = wrapper.getComponent(ExplicitBadge);
          expect(badge.classes()).toContain("size-4");
          expect(badge.classes()).toContain(
            "[--explicit-icon-square:rgba(255,255,255,0.25)]",
          );
          expect(badge.classes()).toContain("[--explicit-icon-letter:#fff]");
          expect(badge.getComponent(ExplicitIcon).get("text").text()).toBe("E");
        }
      }
    },
  );
});
