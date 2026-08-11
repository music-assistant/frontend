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
    const wrapper = mountToggle();

    await wrapper.get('[data-testid="advanced-settings"]').trigger("click");

    expect(wrapper.emitted("update:showAdvancedSettings")).toEqual([[true]]);
  });

  it("follows the state its screen hands it", async () => {
    const wrapper = mountToggle();
    const toggle = wrapper.get('[data-testid="advanced-settings"]');
    expect(toggle.attributes("data-state")).toBe("unchecked");

    await wrapper.setProps({ showAdvancedSettings: true });

    expect(toggle.attributes("data-state")).toBe("checked");
  });

  it("labels every toggle on a screen with an id of its own", () => {
    const wrapper = mount(TwoToggles, {
      global: { mocks: { $t: (key: string) => key } },
    });
    const labels = wrapper.findAll("label");

    const firstId = wrapper
      .get('[data-testid="first-toggle"]')
      .attributes("id");
    const secondId = wrapper
      .get('[data-testid="second-toggle"]')
      .attributes("id");

    expect(labels[0].attributes("for")).toBe(firstId);
    expect(labels[1].attributes("for")).toBe(secondId);
    expect(firstId).not.toBe(secondId);
  });
});

function mountToggle() {
  return mount(AdvancedSettingsToggle, {
    props: { testId: "advanced-settings" },
    global: { mocks: { $t: (key: string) => key } },
  });
}
