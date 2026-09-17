import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { h } from "vue";

function mountTabs(listProps: InstanceType<typeof TabsList>["$props"] = {}) {
  return mount(Tabs, {
    props: { defaultValue: "artists" },
    slots: {
      default: () =>
        h(TabsList, listProps, () => [
          h(TabsTrigger, { value: "artists" }, () => "Artists"),
        ]),
    },
  });
}

describe("TabsList", () => {
  it("is the pill list by default", () => {
    const list = mountTabs().get('[data-slot="tabs-list"]');

    expect(list.attributes("data-variant")).toBe("default");
    expect(list.classes()).toEqual(
      expect.arrayContaining(["bg-muted", "h-9", "rounded-lg", "p-[3px]"]),
    );
  });

  it("drops the pill for the underlined page tabs", () => {
    const list = mountTabs({ variant: "line" }).get('[data-slot="tabs-list"]');

    expect(list.attributes("data-variant")).toBe("line");
    expect(list.classes()).toEqual(
      expect.arrayContaining(["gap-6", "bg-transparent"]),
    );
    // the list hugs its tabs instead of filling the row with a centred pair
    expect(list.classes()).toEqual(
      expect.not.arrayContaining(["bg-muted", "h-9", "p-[3px]", "w-auto"]),
    );
    // reka has no variant prop, so it must not reach the element
    expect(list.attributes("variant")).toBeUndefined();
  });

  it("keeps a caller's own classes next to the variant", () => {
    const list = mountTabs({ variant: "line", class: "mb-4" }).get(
      '[data-slot="tabs-list"]',
    );

    expect(list.classes()).toEqual(
      expect.arrayContaining(["mb-4", "bg-transparent"]),
    );
  });
});
