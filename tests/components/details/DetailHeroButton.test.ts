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
  it("renders the label as text and as the accessible name", () => {
    // the label always renders; a container query hides it on a compact hero
    const wrapper = mountButton();
    expect(wrapper.find(".detail-hero-button__label").text()).toBe(
      "Track radio",
    );
    expect(wrapper.attributes("aria-label")).toBe("Track radio");
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
