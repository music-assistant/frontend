import { Item, ItemGroup, itemGroupInjectionKey } from "@/components/ui/item";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { h } from "vue";

const inGroup = { global: { provide: { [itemGroupInjectionKey]: true } } };

describe("Item", () => {
  it("wraps every row in an ItemGroup in a listitem", () => {
    const group = mount(ItemGroup, {
      slots: { default: () => [h(Item, () => "one"), h(Item, () => "two")] },
    });

    expect(group.element.getAttribute("role")).toBe("list");
    const rows = group.findAllComponents(Item);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.element.getAttribute("role")).toBe("listitem");
      expect(row.element.classList).toContain("contents");
      expect(row.get('[data-slot="item"]').attributes("role")).toBeUndefined();
    }
  });

  it("stays role-free when used standalone", () => {
    const item = mount(Item, { slots: { default: "solo" } });

    expect(item.element.getAttribute("role")).toBeNull();
    expect(item.attributes("data-slot")).toBe("item");
  });

  it("keeps a caller role on the row while the listitem wraps it", () => {
    const item = mount(Item, {
      props: { role: "option" },
      slots: { default: "choice" },
      ...inGroup,
    });

    expect(item.element.getAttribute("role")).toBe("listitem");
    expect(item.get('[data-slot="item"]').attributes("role")).toBe("option");
  });

  it("re-resolves the row role when a caller role is removed", async () => {
    const item = mount(Item, {
      props: { role: "option" },
      slots: { default: "choice" },
      ...inGroup,
    });
    expect(item.get('[data-slot="item"]').attributes("role")).toBe("option");

    await item.setProps({ role: undefined });
    expect(item.get('[data-slot="item"]').attributes("role")).toBeUndefined();
  });

  it("treats a null caller role as absent", () => {
    const item = mount(Item, {
      props: { role: null },
      slots: { default: "row" },
      ...inGroup,
    });

    expect(item.element.getAttribute("role")).toBe("listitem");
    expect(item.get('[data-slot="item"]').attributes("role")).toBeUndefined();
  });

  it("keeps native button semantics inside the listitem wrapper", () => {
    const group = mount(ItemGroup, {
      slots: { default: () => h(Item, { as: "button" }, () => "go") },
    });
    const wrapper = group.get('[role="listitem"]');
    const button = group.get("button");

    expect(wrapper.classes()).toContain("contents");
    expect(button.attributes("role")).toBeUndefined();
    expect(wrapper.element.contains(button.element)).toBe(true);
  });

  it("keeps native link semantics for an as-child row inside the wrapper", () => {
    const group = mount(ItemGroup, {
      slots: {
        default: () =>
          h(Item, { asChild: true }, () => h("a", { href: "/x" }, "link")),
      },
    });
    const wrapper = group.get('[role="listitem"]');
    const link = group.get("a");

    expect(link.attributes("role")).toBeUndefined();
    expect(wrapper.element.contains(link.element)).toBe(true);
  });
});
