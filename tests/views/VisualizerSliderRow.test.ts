import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { Slider } from "@/components/ui/slider";
import VisualizerSliderRow from "@/views/settings/VisualizerSliderRow.vue";

describe("VisualizerSliderRow", () => {
  it("shows the dragged value live but persists it only once the drag ends", async () => {
    const wrapper = mountRow();
    const slider = wrapper.findComponent(Slider);

    slider.vm.$emit("update:modelValue", [60]);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("60%");
    expect(wrapper.emitted("commit")).toBeUndefined();

    slider.vm.$emit("valueCommit", [60]);
    expect(wrapper.emitted("commit")).toEqual([[60]]);
  });

  it("follows the preference when it changes elsewhere", async () => {
    const wrapper = mountRow();

    await wrapper.setProps({ value: 80 });

    expect(wrapper.text()).toContain("80%");
  });

  it("names the slider thumb after the visible label", () => {
    const wrapper = mountRow();

    expect(wrapper.findComponent(Slider).props("thumbLabel")).toBe("Opacity");
  });
});

function mountRow() {
  return shallowMount(VisualizerSliderRow, {
    props: {
      value: 40,
      defaultValue: 40,
      label: "Opacity",
      description: "How opaque",
      min: 10,
      max: 100,
      step: 5,
      unit: "%",
    },
  });
}
