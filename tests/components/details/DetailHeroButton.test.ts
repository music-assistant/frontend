import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import { Radio } from "@lucide/vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/breakpoint", () => ({
  isPhoneSizedScreen: () => false,
}));

function mountButton(props = {}) {
  return mount(DetailHeroButton, {
    props: { icon: Radio, label: "Track radio", ...props },
  });
}

describe("DetailHeroButton", () => {
  it("shows the label beside the icon unless it is icon-only", () => {
    const withText = mountButton();
    expect(withText.text()).toBe("Track radio");
    expect(withText.classes()).not.toContain("detail-hero-button--icon-only");

    // the label stays the accessible name
    const iconOnly = mountButton({ iconOnly: true });
    expect(iconOnly.text()).toBe("");
    expect(iconOnly.attributes("aria-label")).toBe("Track radio");
    expect(iconOnly.classes()).toContain("detail-hero-button--icon-only");
  });

  it("reports the pressed state only for a toggle", () => {
    expect(mountButton().attributes("aria-pressed")).toBeUndefined();
    expect(mountButton({ pressed: true }).attributes("aria-pressed")).toBe(
      "true",
    );
    expect(mountButton({ pressed: false }).attributes("aria-pressed")).toBe(
      "false",
    );
  });

  it("emits click", async () => {
    const wrapper = mountButton();
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });
});
