import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AdvancedSettingsToggle from "@/views/settings/AdvancedSettingsToggle.vue";

const TwoToggles = {
  components: { AdvancedSettingsToggle },
  template: `
    <AdvancedSettingsToggle test-id="first-toggle" />
    <AdvancedSettingsToggle test-id="second-toggle" />
  `,
};

describe("AdvancedSettingsToggle", () => {
  it("reports the toggle being flipped", async () => {
    const wrapper = mount(AdvancedSettingsToggle, {
      props: { testId: "advanced-settings" },
      global: { mocks: { $t: (key: string) => key } },
    });

    await wrapper.get('[data-testid="advanced-settings"]').trigger("click");

    expect(wrapper.emitted("update:showAdvancedSettings")).toEqual([[true]]);
  });

  it("labels every toggle on a screen with an id of its own", () => {
    const wrapper = mount(TwoToggles, {
      global: { mocks: { $t: (key: string) => key } },
    });

    const ids = ["first-toggle", "second-toggle"].map((testId, index) => {
      const id = wrapper.get(`[data-testid="${testId}"]`).attributes("id");
      expect(wrapper.findAll("label")[index].attributes("for")).toBe(id);
      return id;
    });

    expect(ids[0]).not.toBe(ids[1]);
  });
});
