import ListingSortMenu from "@/components/listing-toolbar/ListingSortMenu.vue";
import ListingToolbarControls from "@/components/listing-toolbar/ListingToolbarControls.vue";
import type { GridSizeControls } from "@/helpers/grid_size";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

enableAutoUnmount(afterEach);

const GRID_CONTROLS: GridSizeControls = {
  size: 0,
  showActions: true,
  actionsFit: true,
  supportsActions: true,
  onChange: () => {},
  onCommit: () => {},
  onToggleActions: () => {},
};

function mountControls(viewMode: string) {
  return mount(ListingToolbarControls, {
    props: {
      sortOptions: [],
      sortBy: "",
      viewMode,
      showViewModes: false,
      gridControls: GRID_CONTROLS,
      filters: [],
      activeFilterCount: 0,
      compact: false,
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { ListingSortMenu: true },
    },
  });
}

describe("ListingToolbarControls", () => {
  it("keeps the cover size menu when the page sets the thumbs view without sort options", () => {
    const controls = mountControls("panel");

    expect(controls.findComponent(ListingSortMenu).exists()).toBe(true);
  });

  it("shows no menu when the page sets the list view without sort options", () => {
    const controls = mountControls("list");

    expect(controls.findComponent(ListingSortMenu).exists()).toBe(false);
  });
});
