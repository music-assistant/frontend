import type { ListingViewMode } from "@/components/listing-toolbar/constants";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  gridColumns,
  normalizeGridSize,
  PANEL_ACTIONS_MIN_WIDTH,
  type GridSizeControls,
} from "@/helpers/grid_size";
import { panelViewItemResponsive } from "@/helpers/utils";
import { useResizeObserver } from "@vueuse/core";
import { computed, reactive, ref, watch } from "vue";

/**
 * The view mode, cover size and card actions of a page that shows its items in
 * the list and panel views of the other listings, kept per user as theirs are.
 *
 * Bind `gridEl` to the grid of the panel view, and mark the artwork of each card
 * with `data-card-art`, so the cards drop their actions when they get too small.
 *
 * @param path - The key the preferences of the page are kept under.
 */
export function useListingView(path: string) {
  const { getItemsListingPreferences, setItemsListingPreference } =
    useUserPreferences();
  const preferences = getItemsListingPreferences(path, path);

  const viewMode = computed<ListingViewMode>(() =>
    preferences.value.viewMode === "panel" ? "panel" : "list",
  );
  const selectViewMode = (mode: ListingViewMode) =>
    setItemsListingPreference(path, path, "viewMode", mode);

  // the size the slider is dragged to, until it is saved
  const draggedSize = ref<number>();
  const gridSize = computed(
    () => draggedSize.value ?? normalizeGridSize(preferences.value.gridSize),
  );
  const columnCount = computed(() =>
    gridColumns(panelViewItemResponsive(0), gridSize.value),
  );
  const showActions = computed(() => preferences.value.showActions ?? true);

  const gridEl = ref<HTMLElement>();
  const actionsFit = ref(true);
  const updateActionsFit = () => {
    const width = gridEl.value
      ?.querySelector("[data-card-art]")
      ?.getBoundingClientRect().width;
    actionsFit.value = !width || width >= PANEL_ACTIONS_MIN_WIDTH;
  };
  useResizeObserver(gridEl, updateActionsFit);
  watch(columnCount, updateActionsFit, { flush: "post" });

  // the menu reads these as they change
  const gridControls: GridSizeControls = reactive({
    size: gridSize,
    showActions,
    actionsFit,
    supportsActions: true,
    onChange: (size: number) => {
      draggedSize.value = size;
    },
    onCommit: async (size: number) => {
      draggedSize.value = size;
      await setItemsListingPreference(path, path, "gridSize", size);
      // a drag that started while it saved keeps its own size
      if (draggedSize.value === size) draggedSize.value = undefined;
    },
    onToggleActions: (show: boolean) =>
      setItemsListingPreference(path, path, "showActions", show),
  });

  return {
    viewMode,
    selectViewMode,
    columnCount,
    gridControls,
    showActions: computed(() => showActions.value && actionsFit.value),
    gridEl,
  };
}
