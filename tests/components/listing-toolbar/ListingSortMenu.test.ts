import ListingSortMenu from "@/components/listing-toolbar/ListingSortMenu.vue";
import ListingViewModeRow from "@/components/listing-toolbar/ListingViewModeRow.vue";
import GridSizeSlider from "@/components/GridSizeSlider.vue";
import type { GridSizeControls } from "@/helpers/grid_size";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

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

// the menu's parts render in place, so its content shows without opening it
const SLOT_STUB = { template: "<div><slot /></div>" };

function mountMenu(viewMode: string, fixedView: boolean) {
  return mount(ListingSortMenu, {
    props: {
      options: [],
      sortBy: "",
      viewMode,
      fixedView,
      gridControls: GRID_CONTROLS,
      compact: false,
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        DropdownMenu: SLOT_STUB,
        DropdownMenuTrigger: SLOT_STUB,
        DropdownMenuContent: SLOT_STUB,
        DropdownMenuLabel: SLOT_STUB,
        DropdownMenuRadioGroup: SLOT_STUB,
        DropdownMenuRadioItem: SLOT_STUB,
        DropdownMenuSeparator: true,
        ListingViewModeRow: true,
        GridSizeSlider: true,
      },
    },
  });
}

describe("ListingSortMenu", () => {
  it("offers the view and the cover size in the thumbs view", () => {
    const menu = mountMenu("panel", false);

    expect(menu.findComponent(ListingViewModeRow).exists()).toBe(true);
    expect(menu.findComponent(GridSizeSlider).exists()).toBe(true);
  });

  it("keeps the cover size but not the view when the page sets the thumbs view", () => {
    const menu = mountMenu("panel", true);

    expect(menu.findComponent(ListingViewModeRow).exists()).toBe(false);
    expect(menu.findComponent(GridSizeSlider).exists()).toBe(true);
  });

  it("offers neither when the page sets the list view", () => {
    const menu = mountMenu("list", true);

    expect(menu.findComponent(ListingViewModeRow).exists()).toBe(false);
    expect(menu.findComponent(GridSizeSlider).exists()).toBe(false);
    expect(menu.find("button").attributes("disabled")).toBeDefined();
  });
});
