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
  DropdownMenuItem: {
    name: "DropdownMenuItem",
    props: ["disabled"],
    template: "<div><slot /></div>",
  },
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

  it("keeps the reset out of reach while the screen asks for that", () => {
    const resetDisabled = (props: Record<string, unknown>) =>
      mountHeader(props)
        .findComponent({ name: "DropdownMenuItem" })
        .props("disabled");

    expect(resetDisabled({})).toBe(false);
    expect(resetDisabled({ resetDisabled: true })).toBe(true);
  });

  it("links the documentation it is given", () => {
    const link = mountHeader({
      documentationUrl: "https://music-assistant.io/settings/core/",
    }).get('[data-testid="settings-documentation"]');

    expect(link.attributes("href")).toBe(
      "https://music-assistant.io/settings/core/",
    );
    expect(link.attributes("target")).toBe("_blank");
  });

  it("leaves out the documentation row without a link", () => {
    expect(
      mountHeader().find('[data-testid="settings-documentation"]').exists(),
    ).toBe(false);
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
