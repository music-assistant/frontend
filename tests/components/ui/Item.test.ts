import { Item, ItemGroup, itemGroupInjectionKey } from "@/components/ui/item";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { h } from "vue";

const inGroup = { global: { provide: { [itemGroupInjectionKey]: true } } };

describe("Item", () => {
  it("exposes role=listitem for rows inside an ItemGroup", () => {
    const group = mount(ItemGroup, {
      slots: { default: () => [h(Item, () => "one"), h(Item, () => "two")] },
    });

    expect(group.element.getAttribute("role")).toBe("list");
    const rows = group.findAllComponents(Item);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.element.getAttribute("role")).toBe("listitem");
    }
  });

  it("stays role-free when used standalone", () => {
    const item = mount(Item, { slots: { default: "solo" } });

    expect(item.element.getAttribute("role")).toBeNull();
  });

  it("keeps a caller-provided role instead of overriding it", () => {
    const group = mount(ItemGroup, {
      slots: { default: () => h(Item, { role: "option" }, () => "choice") },
    });

    expect(group.findComponent(Item).element.getAttribute("role")).toBe(
      "option",
    );
  });

  it("restores the listitem role when a caller role is removed", async () => {
    const item = mount(Item, {
      props: { role: "option" },
      slots: { default: "choice" },
      ...inGroup,
    });
    expect(item.element.getAttribute("role")).toBe("option");

    await item.setProps({ role: undefined });
    expect(item.element.getAttribute("role")).toBe("listitem");
  });

  it("treats a null caller role as absent", () => {
    const item = mount(Item, {
      props: { role: null },
      slots: { default: "row" },
      ...inGroup,
    });

    expect(item.element.getAttribute("role")).toBe("listitem");
  });

  it("wraps an interactive row in a listitem while keeping its button role", () => {
    const group = mount(ItemGroup, {
      slots: { default: () => h(Item, { as: "button" }, () => "go") },
    });
    const button = group.get("button");
    const wrapper = group.get('[role="listitem"]');

    expect(button.attributes("role")).toBeUndefined();
    expect(wrapper.classes()).toContain("contents");
    expect(wrapper.element.contains(button.element)).toBe(true);
  });

  it("wraps an as-child row in a listitem while keeping its link role", () => {
    const group = mount(ItemGroup, {
      slots: {
        default: () =>
          h(Item, { asChild: true }, () => h("a", { href: "/x" }, "link")),
      },
    });
    const link = group.get("a");
    const wrapper = group.get('[role="listitem"]');

    expect(link.attributes("role")).toBeUndefined();
    expect(wrapper.element.contains(link.element)).toBe(true);
  });
});
