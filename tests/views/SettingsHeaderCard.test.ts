import { shallowMount } from "@vue/test-utils";
import { Settings2 } from "@lucide/vue";
import { describe, expect, it } from "vitest";
import SettingsHeaderCard from "@/views/settings/SettingsHeaderCard.vue";

const SlotStub = {
  template: "<div><slot /></div>",
};

const headerStubs = {
  Button: SlotStub,
  Card: SlotStub,
  CardContent: SlotStub,
  CardDescription: SlotStub,
  CardHeader: SlotStub,
  CardTitle: SlotStub,
  DropdownMenu: SlotStub,
  DropdownMenuContent: SlotStub,
  DropdownMenuItem: SlotStub,
  DropdownMenuTrigger: SlotStub,
};

describe("SettingsHeaderCard", () => {
  it("names what is being configured", () => {
    const wrapper = mountHeader({ description: "Everything cached" });

    expect(wrapper.text()).toContain("Cache");
    expect(wrapper.text()).toContain("Everything cached");
  });

  it("asks the settings screen to reset the form", async () => {
    const wrapper = mountHeader();

    await wrapper
      .get('[data-testid="settings-reset-defaults"]')
      .trigger("click");

    expect(wrapper.emitted("resetToDefaults")).toHaveLength(1);
  });

  it("leaves out the advanced toggle without advanced settings to reveal", () => {
    expect(
      mountHeader().find('[data-testid="settings-advanced-settings"]').exists(),
    ).toBe(false);
  });

  it("reports the advanced toggle being flipped", async () => {
    const wrapper = mountHeader({ showAdvancedToggle: true });

    await wrapper
      .findComponent({ name: "Switch" })
      .vm.$emit("update:modelValue", true);

    expect(wrapper.emitted("update:showAdvancedSettings")).toEqual([[true]]);
  });
});

function mountHeader(props: Record<string, unknown> = {}) {
  return shallowMount(SettingsHeaderCard, {
    props: { icon: Settings2, title: "Cache", ...props },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: headerStubs,
    },
  });
}
