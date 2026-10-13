import ListingSelectionBar from "@/components/ListingSelectionBar.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

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
    await button(wrapper, "tooltip.select_all").trigger("click");
    await button(wrapper, "actions").trigger("click", {
      clientX: 10,
      clientY: 20,
    });

    expect(wrapper.emitted("clear")).toHaveLength(1);
    expect(wrapper.emitted("selectAll")).toHaveLength(1);
    const [[event]] = wrapper.emitted("actions") as [[MouseEvent]];
    expect([event.clientX, event.clientY]).toEqual([10, 20]);
  });

  it("hides select all once everything is selected", () => {
    const wrapper = mountBar({ allSelected: true });

    expect(() => button(wrapper, "tooltip.select_all")).toThrow();
    expect(button(wrapper, "actions").exists()).toBe(true);
  });
});
