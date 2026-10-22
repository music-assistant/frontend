import CommandCenterShell from "@/components/CommandCenterShell.vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  storeMock: { mobileLayout: false },
}));

vi.mock("@/plugins/store", () => ({ store: state.storeMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

/** Renders slot content so the frame's own structure stays visible. */
const passthrough = (tag: string, attrs = "") => ({
  template: `<${tag} ${attrs}><slot /></${tag}>`,
});

function mountShell() {
  return mount(CommandCenterShell, {
    props: { open: true, title: "search", description: "type_to_search" },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Sheet: passthrough("div"),
        SheetContent: passthrough(
          "div",
          'data-player-panel data-testid="sheet"',
        ),
        SheetTitle: passthrough("h2"),
        SheetDescription: passthrough("p"),
        Command: passthrough("div"),
        CommandDialog: passthrough("div", 'data-testid="dialog"'),
      },
    },
    slots: { default: '<span data-testid="palette">palette</span>' },
  });
}

beforeEach(() => {
  state.storeMock.mobileLayout = false;
});

describe("CommandCenterShell", () => {
  it("keeps the centred dialog on a desktop", () => {
    const wrapper = mountShell();

    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sheet"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="palette"]').exists()).toBe(true);
    // the knob belongs to the phone panel, not to a dialog
    expect(wrapper.find(".panel-drag-handle").exists()).toBe(false);
  });

  // the phone gets the app's own panel, the same one the player and volume
  // popouts use, so it is dismissed the way the rest of them are
  it("becomes a panel with a knob on a phone", () => {
    state.storeMock.mobileLayout = true;
    const wrapper = mountShell();

    expect(wrapper.find('[data-testid="sheet"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="palette"]').exists()).toBe(true);
    expect(wrapper.find(".panel-drag-handle").exists()).toBe(true);
  });

  it("closes when the knob is dragged away", async () => {
    state.storeMock.mobileLayout = true;
    const wrapper = mountShell();

    await wrapper
      .findComponent({ name: "PanelDragHandle" })
      .vm.$emit("dismiss");

    expect(wrapper.emitted("update:open")?.at(-1)).toEqual([false]);
  });

  it("names itself for assistive tech without printing a heading", () => {
    state.storeMock.mobileLayout = true;
    const wrapper = mountShell();

    const title = wrapper.get("h2");
    expect(title.text()).toBe("search");
    expect(title.classes()).toContain("sr-only");
  });
});
