import FacetedFilter from "@/components/FacetedFilter.vue";
import ListingMultiFilterField from "@/components/listing-toolbar/ListingMultiFilterField.vue";
import type { ListingMultiFilter } from "@/helpers/listing_filters";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const dropdownFilter = (
  overrides: Partial<ListingMultiFilter> = {},
): ListingMultiFilter => ({
  kind: "multi",
  id: "album_type",
  label: "Album type",
  placeholder: "Any album type",
  layout: "dropdown",
  options: [
    { label: "Album", value: "album" },
    { label: "Single", value: "single" },
    { label: "EP", value: "ep" },
  ],
  selected: ["album", "single"],
  toggle: vi.fn(),
  ...overrides,
});

function mountField(filter: ListingMultiFilter) {
  return mount(ListingMultiFilterField, {
    props: { filter },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { FacetedFilter: true },
    },
  });
}

describe("ListingMultiFilterField", () => {
  it("hands a dropdown's whole selection over in one go", () => {
    const filter = dropdownFilter({ set: vi.fn() });
    const field = mountField(filter);

    field.findComponent(FacetedFilter).vm.$emit("update:modelValue", []);

    expect(filter.set).toHaveBeenCalledOnce();
    expect(filter.set).toHaveBeenCalledWith([]);
    expect(filter.toggle).not.toHaveBeenCalled();
  });

  it("flips each changed value of a filter that takes one at a time", () => {
    const filter = dropdownFilter();
    const field = mountField(filter);

    field
      .findComponent(FacetedFilter)
      .vm.$emit("update:modelValue", ["single", "ep"]);

    expect(vi.mocked(filter.toggle).mock.calls).toEqual([["album"], ["ep"]]);
  });
});
