import ExplicitIcon from "@/components/icons/ExplicitIcon.vue";
import ListviewItemTitle from "@/components/ListviewItemTitle.vue";
import PanelviewItem from "@/components/PanelviewItem.vue";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";
import { track } from "../fixtures/track";

vi.mock("@/helpers/media_item_actions", () => ({
  handleMenuBtnClick: vi.fn(),
}));
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => false },
}));
vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: () => false,
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));
vi.mock("@/components/QualityDetailsBtn.vue", () => ({
  iconHiRes: "",
  default: { template: "<div />" },
}));

describe("media explicit badges", () => {
  it.each([true, false, undefined])(
    "uses the shared badge in list titles for explicit content (%s)",
    (explicit) => {
      const item = track();
      item.metadata.explicit = explicit;
      const wrapper = shallowMount(ListviewItemTitle, {
        props: { item, displayName: item.name },
        global: {
          plugins: [createI18n({ legacy: false, locale: "en" })],
          stubs: {
            ExplicitIcon: false,
            Tooltip: { template: "<div><slot /></div>" },
            TooltipTrigger: { template: "<div><slot /></div>" },
          },
        },
      });

      expect(wrapper.findComponent(ExplicitIcon).exists()).toBe(
        explicit === true,
      );
      if (explicit === true) {
        const badge = wrapper.getComponent(ExplicitIcon);
        expect(badge.element.tagName.toLowerCase()).toBe("svg");
        expect(badge.classes()).toContain("size-6");
        expect(badge.classes()).toContain("scale-90");
        expect(badge.classes()).toContain("[&_text]:fill-background");
        expect(badge.attributes("aria-hidden")).toBe("true");
        expect(badge.element.parentElement?.getAttribute("aria-label")).toBe(
          "tooltip.explicit",
        );
        expect(badge.element.parentElement?.getAttribute("tabindex")).toBe("0");
      }
    },
  );

  it.each([true, false, undefined])(
    "uses the shared badge in panel actions for explicit content (%s)",
    (explicit) => {
      const item = track();
      item.metadata.explicit = explicit;
      const wrapper = shallowMount(PanelviewItem, {
        props: { item, isSelected: false, showActions: true },
        global: {
          mocks: { $t: (key: string) => key },
          stubs: {
            ExplicitIcon: false,
            EditorialMediaCard: {
              template: "<div><slot name='actions' /></div>",
            },
          },
        },
      });

      expect(wrapper.findComponent(ExplicitIcon).exists()).toBe(
        explicit === true,
      );
      if (explicit === true) {
        const badge = wrapper.getComponent(ExplicitIcon);
        expect(badge.element.tagName.toLowerCase()).toBe("svg");
        expect(badge.classes()).toContain("size-[30px]");
        expect(badge.classes()).toContain("scale-90");
        expect(badge.classes()).toContain("[&_text]:fill-background");
        expect(badge.attributes("aria-hidden")).toBe("false");
        expect(badge.attributes("role")).toBe("img");
        expect(badge.attributes("aria-label")).toBe("tooltip.explicit");
      }
    },
  );
});
