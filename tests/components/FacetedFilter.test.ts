import FacetedFilter from "@/components/FacetedFilter.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

const stubs = {
  Popover: { template: "<div><slot /></div>" },
  PopoverTrigger: { template: "<div><slot /></div>" },
  PopoverContent: { template: "<div><slot /></div>" },
  Button: { template: "<button><slot /></button>" },
  Badge: { template: "<span><slot /></span>" },
  Separator: { template: "<span />" },
  Checkbox: { template: '<input type="checkbox" />' },
  Input: { template: "<input />" },
};

describe("FacetedFilter", () => {
  it("toggles a focused option with Enter", async () => {
    const wrapper = mount(FacetedFilter, {
      props: {
        title: "Media type",
        options: [{ label: "Albums", value: "album" }],
        modelValue: [],
      },
      global: { stubs },
    });

    await wrapper.get(".faceted-filter-item").trigger("keydown.enter");

    expect(wrapper.emitted("update:modelValue")).toEqual([[["album"]]]);
  });
});
