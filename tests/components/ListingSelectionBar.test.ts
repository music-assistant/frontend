import ListingSelectionBar from "@/components/ListingSelectionBar.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

enableAutoUnmount(afterEach);

/** Mounts the bar open, with the count a plural message was asked for shown. */
function mountBar(props: Partial<{ count: number; allSelected: boolean }>) {
  return mount(ListingSelectionBar, {
    props: { open: true, count: 3, allSelected: false, ...props },
    global: {
      stubs: { teleport: true },
      mocks: {
        $t: (key: string, count?: number) =>
          typeof count === "number" ? `${key}:${count}` : key,
      },
    },
  });
}

/** The button with this accessible label or text. */
function button(wrapper: ReturnType<typeof mountBar>, label: string) {
  const match = wrapper
    .findAll("button")
    .find(
      (b) => b.attributes("aria-label") === label || b.text().trim() === label,
    );
  if (!match) throw new Error(`no button labelled ${label}`);
  return match;
}

describe("ListingSelectionBar", () => {
  it("shows the selected count as a toolbar that announces it", () => {
    const wrapper = mountBar({ count: 3 });

    const toolbar = wrapper.get('[role="toolbar"]');
    expect(toolbar.attributes("aria-label")).toBe("selection_actions");
    const count = wrapper.get('[aria-live="polite"]');
    expect(count.text()).toBe("n_selected:3");
  });

  it("is not rendered while closed", async () => {
    const wrapper = mountBar({});

    await wrapper.setProps({ open: false });

    expect(wrapper.find('[role="toolbar"]').exists()).toBe(false);
  });

  it("emits clear, select all and actions from its buttons", async () => {
    const wrapper = mountBar({});

    await button(wrapper, "clear_selection").trigger("click");
    await button(wrapper, "select_all").trigger("click");
    const actions = button(wrapper, "actions");
    vi.spyOn(actions.element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 500, 80, 32),
    );
    await actions.trigger("click");

    expect(wrapper.emitted("clear")).toHaveLength(1);
    expect(wrapper.emitted("selectAll")).toHaveLength(1);
    // the menu hangs above the button's top right corner
    expect(wrapper.emitted("actions")).toEqual([[{ x: 180, y: 492 }]]);
  });

  it("hides select all once everything is selected", () => {
    const wrapper = mountBar({ allSelected: true });

    expect(() => button(wrapper, "select_all")).toThrow();
    expect(button(wrapper, "actions").exists()).toBe(true);
  });
});
