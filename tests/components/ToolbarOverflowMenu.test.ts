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
  it("names who added an entry on a muted line under it, cut off as the rest", () => {
    const wrapper = mount(Toolbar, {
      props: {
        menuItems: [
          { label: "settings" },
          {
            label: "provider_menu_action/demo/a",
            text: "Ask the demo plugin about this",
            addedBy: "{0} @:show_info",
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
          DropdownMenuTrigger: passthroughStub,
        },
      },
    });

    const lines = wrapper.findAll("span.truncate");
    expect(lines.map((line) => line.text())).toEqual([
      "settings",
      "Ask the demo plugin about this",
      "{0} @:show_info",
    ]);
    expect(lines[2].classes()).toEqual(
      expect.arrayContaining(["text-muted-foreground", "text-xs"]),
    );
    // the column may shrink, so each line is cut off within the capped menu
    expect([...lines[1].element.parentElement!.classList]).toEqual(
      expect.arrayContaining(["min-w-0", "flex-1"]),
    );
    expect(wrapper.find(".max-w-\\[350px\\]").exists()).toBe(true);
  });
});
