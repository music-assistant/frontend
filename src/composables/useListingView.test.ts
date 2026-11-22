import type { ItemsListingPreferences } from "@/composables/userPreferences";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useListingView } from "./useListingView";

const { prefs, setPreference } = await vi.hoisted(async () => {
  const { ref } = await import("vue");
  return {
    // the user's stored preferences of the page
    prefs: ref<ItemsListingPreferences>({}),
    setPreference: vi.fn(),
  };
});

vi.mock("@/composables/userPreferences", async () => {
  const { computed } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useUserPreferences: () => ({
      getItemsListingPreferences: () => computed(() => prefs.value),
      setItemsListingPreference: setPreference,
    }),
  };
});
// a window that fits five columns by default
vi.mock("@/helpers/utils", () => ({ panelViewItemResponsive: () => 5 }));

describe("useListingView", () => {
  beforeEach(() => {
    prefs.value = {};
    setPreference.mockReset();
    setPreference.mockImplementation(
      async (_path: string, _type: string, key: string, value: unknown) => {
        // the optimistic local update of the user preferences
        prefs.value = { ...prefs.value, [key]: value };
      },
    );
  });

  it("starts as a list with the default columns and the card actions", () => {
    const view = useListingView("page");
    expect(view.viewMode.value).toBe("list");
    expect(view.columnCount.value).toBe(5);
    expect(view.showActions.value).toBe(true);
  });

  it("keeps the view mode of the user", async () => {
    const view = useListingView("page");
    await view.selectViewMode("panel");
    expect(setPreference).toHaveBeenCalledWith(
      "page",
      "page",
      "viewMode",
      "panel",
    );
    expect(view.viewMode.value).toBe("panel");
  });

  it("follows the slider, and keeps the size it is let go at", async () => {
    const view = useListingView("page");
    view.gridControls.onChange(-2);
    expect(view.columnCount.value).toBe(7);
    expect(setPreference).not.toHaveBeenCalled();
    view.gridControls.onCommit(1);
    await flushPromises();
    expect(setPreference).toHaveBeenCalledWith("page", "page", "gridSize", 1);
    expect(view.columnCount.value).toBe(4);
  });

  it("keeps following a drag that starts while the last size saves", async () => {
    let finishSave: () => void = () => {};
    setPreference.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const view = useListingView("page");
    void view.gridControls.onCommit(1);
    view.gridControls.onChange(-2);
    finishSave();
    await flushPromises();
    expect(view.columnCount.value).toBe(7);
  });

  it("keeps the card actions hidden when the user hides them", async () => {
    const view = useListingView("page");
    view.gridControls.onToggleActions(false);
    await flushPromises();
    expect(view.showActions.value).toBe(false);
    expect(view.gridControls.showActions).toBe(false);
  });
});
