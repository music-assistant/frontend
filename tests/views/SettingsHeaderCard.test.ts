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
