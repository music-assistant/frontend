import { Item, ItemGroup } from "@/components/ui/item";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { h } from "vue";

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

  it("keeps native link semantics for an as-child row instead of listitem", () => {
    const group = mount(ItemGroup, {
      slots: {
        default: () =>
          h(Item, { asChild: true }, () => h("a", { href: "/x" }, "link")),
      },
    });
    const link = group.get("a");

    expect(link.attributes("role")).toBeUndefined();
  });

  it("keeps native button semantics for an interactive row instead of listitem", () => {
    const group = mount(ItemGroup, {
      slots: { default: () => h(Item, { as: "button" }, () => "go") },
    });
    const button = group.get("button");

    expect(button.attributes("role")).toBeUndefined();
  });
});
