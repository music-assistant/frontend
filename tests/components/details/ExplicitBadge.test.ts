import DetailHeroTitle from "@/components/details/DetailHeroTitle.vue";
import ExplicitBadge from "@/components/details/ExplicitBadge.vue";
import ExplicitIcon from "@/components/icons/ExplicitIcon.vue";
import { mount } from "@vue/test-utils";
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
  getDeclaredContextMenuItems: vi.fn(() => []),
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
    },
  );

  it.each([
    ["album", album({ metadata: { explicit: true } })],
    ["track", track({ metadata: { explicit: true } })],
  ])("uses the shared overlay badge in the %s hero's title", (_, item) => {
    const badge = mount(DetailHeroTitle, { props: { item } }).getComponent(
      ExplicitBadge,
    );
    expect(badge.classes()).toContain(
      "[--explicit-icon-square:rgba(255,255,255,0.25)]",
    );
    expect(badge.classes()).toContain("[--explicit-icon-letter:#fff]");
  });
});
