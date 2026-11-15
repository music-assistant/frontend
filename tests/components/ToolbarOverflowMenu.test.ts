import Toolbar from "@/components/Toolbar.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";

vi.mock("@/plugins/breakpoint", () => ({ getBreakpointValue: () => false }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("@/plugins/store", () => ({ store: {} }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const passthroughStub = { template: "<div><slot /></div>" };

describe("the overflow menu of the toolbar", () => {
  it("shows a plugin's entries as they are in a submenu under its name, cut off as the rest", () => {
    const wrapper = mount(Toolbar, {
      props: {
        menuItems: [
          { label: "settings" },
          {
            label: "provider_menu/demo",
            text: "{0} @:show_info",
            subItems: [
              {
                label: "provider_menu_action/demo/a",
                text: "Ask the demo plugin about this",
              },
            ],
          },
        ],
      },
      global: {
        plugins: [createVuetify({ components })],
        mocks: { $t: (key: string) => key },
        stubs: {
          DropdownMenu: passthroughStub,
          DropdownMenuContent: passthroughStub,
          DropdownMenuItem: passthroughStub,
          DropdownMenuSub: passthroughStub,
          DropdownMenuSubContent: passthroughStub,
          DropdownMenuSubTrigger: passthroughStub,
          DropdownMenuTrigger: passthroughStub,
        },
      },
    });

    const lines = wrapper.findAll("span.truncate");
    expect(lines.map((line) => line.text())).toEqual([
      "settings",
      "{0} @:show_info",
      "Ask the demo plugin about this",
    ]);
    expect(lines.every((line) => line.classes().includes("min-w-0"))).toBe(
      true,
    );
    // the menu and the submenu are capped, so a long entry is cut off on a phone
    expect(wrapper.find(".max-w-\\[350px\\]").exists()).toBe(true);
    expect(lines[2].element.parentElement!.parentElement!.classList).toContain(
      "max-w-[min(92vw,350px)]",
    );
  });
});
