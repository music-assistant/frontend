import { describe, expect, it, vi } from "vitest";
import {
  type CommunityCatalogMenuState,
  getCommunityCatalogMenuItems,
} from "./community_catalog_menu";

const catalog = (
  state: Partial<CommunityCatalogMenuState>,
): CommunityCatalogMenuState => ({
  status: "ready",
  enabled: false,
  saving: false,
  setEnabled: vi.fn(),
  retry: vi.fn(),
  ...state,
});

describe("the menu of the community catalog", () => {
  it("offers to switch it on while it is off", () => {
    const state = catalog({ enabled: false });

    const items = getCommunityCatalogMenuItems(state);

    expect(items.map((item) => item.label)).toEqual([
      "settings.catalog.community.enable",
    ]);
    items[0].action!();
    expect(state.setEnabled).toHaveBeenCalledWith(true);
  });

  it("offers to switch it off while it is on", () => {
    const state = catalog({ enabled: true });

    const items = getCommunityCatalogMenuItems(state);

    expect(items.map((item) => item.label)).toEqual([
      "settings.catalog.community.disable",
    ]);
    items[0].action!();
    expect(state.setEnabled).toHaveBeenCalledWith(false);
  });

  it("switches the way the menu said when it was opened", () => {
    const state = catalog({ enabled: false });
    const [item] = getCommunityCatalogMenuItems(state);

    state.enabled = true;
    item.action!();

    expect(state.setEnabled).toHaveBeenCalledWith(true);
  });

  it("holds the switch while it is being saved", () => {
    const [item] = getCommunityCatalogMenuItems(catalog({ saving: true }));

    expect(item.disabled).toBe(true);
  });

  it("says it is not available, with a way to try again", () => {
    const state = catalog({ status: "unavailable" });

    const items = getCommunityCatalogMenuItems(state);

    expect(items.map((item) => [item.label, !!item.disabled])).toEqual([
      ["settings.catalog.community.unavailable", true],
      ["settings.retry", false],
    ]);
    items[1].action!();
    expect(state.retry).toHaveBeenCalled();
    expect(state.setEnabled).not.toHaveBeenCalled();
  });
});
