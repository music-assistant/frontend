import { describe, expect, it, vi } from "vitest";
import { communityProvider } from "../../tests/fixtures/communityProvider";
import {
  type CommunityCatalogMenuState,
  getCommunityCatalogMenuItems,
} from "./community_catalog_menu";

const catalog = (
  state: Partial<CommunityCatalogMenuState>,
): CommunityCatalogMenuState => ({
  status: "ready",
  enabled: false,
  installed: [],
  saving: false,
  autoUpdate: false,
  savingAutoUpdate: false,
  refreshing: false,
  setEnabled: vi.fn(),
  setAutoUpdate: vi.fn(),
  refresh: vi.fn(),
  retry: vi.fn(),
  ...state,
});

describe("the menu of the community catalog", () => {
  it("only offers to switch it on while it is off and nothing is installed", () => {
    const state = catalog({ enabled: false });

    const items = getCommunityCatalogMenuItems(state);

    expect(items.map((item) => item.label)).toEqual([
      "settings.catalog.community.enable",
    ]);
    items[0].action!();
    expect(state.setEnabled).toHaveBeenCalledWith(true);
  });

  it("offers to check for changes and switch it on while it is off and something is installed", () => {
    const state = catalog({
      enabled: false,
      installed: [communityProvider("radio")],
    });

    const items = getCommunityCatalogMenuItems(state);

    expect(items.map((item) => item.label)).toEqual([
      "settings.catalog.community.refresh",
      "settings.catalog.community.enable",
    ]);
    items[0].action!();
    expect(state.refresh).toHaveBeenCalled();
  });

  it("offers to check for changes, update automatically and switch it off while it is on", () => {
    const state = catalog({ enabled: true });

    const items = getCommunityCatalogMenuItems(state);

    expect(items.map((item) => item.label)).toEqual([
      "settings.catalog.community.refresh",
      "settings.catalog.community.auto_update",
      "settings.catalog.community.disable",
    ]);
    items[2].action!();
    expect(state.setEnabled).toHaveBeenCalledWith(false);
  });

  it("checks for changes", () => {
    const state = catalog({ enabled: true });

    getCommunityCatalogMenuItems(state)[0].action!();

    expect(state.refresh).toHaveBeenCalled();
  });

  it.each([false, true])(
    "shows automatic updates as %s and toggles them",
    (autoUpdate) => {
      const state = catalog({ enabled: true, autoUpdate });

      const item = getCommunityCatalogMenuItems(state)[1];

      expect(item.selected).toBe(autoUpdate);
      item.action!();
      expect(state.setAutoUpdate).toHaveBeenCalledWith(!autoUpdate);
    },
  );

  it("holds checking for changes and automatic updates while they run", () => {
    const items = getCommunityCatalogMenuItems(
      catalog({ enabled: true, refreshing: true, savingAutoUpdate: true }),
    );

    expect(items.map((item) => !!item.disabled)).toEqual([true, true, false]);
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
