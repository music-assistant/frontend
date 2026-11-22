import { setUserPreference } from "@/composables/userPreferences";
import { gridColumns, normalizeGridSize } from "@/helpers/grid_size";
import { panelViewItemResponsive } from "@/helpers/utils";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { computed, ref } from "vue";

const SHELF_SIZE_PREFERENCE_KEY = "discover.gridSize";

// the size the slider is dragged to, until it is saved; every shelf follows it
const draggedSize = ref<number>();

/**
 * The cover size of every shelf, picked on the Discover page with the slider
 * of the library listings, and kept per user.
 */
export function useShelfSize() {
  const size = computed(
    () =>
      draggedSize.value ??
      normalizeGridSize(
        store.currentUser?.preferences?.[SHELF_SIZE_PREFERENCE_KEY],
      ),
  );

  /**
   * Tiles per shelf width: the columns of a listing at the picked size, plus
   * part of the next tile.
   *
   * @param peek - The part of the next tile that shows.
   * @param phonePeek - The same on a phone.
   */
  const tilesPerView = (peek: number, phonePeek: number): number =>
    gridColumns(panelViewItemResponsive(0), size.value) +
    (getBreakpointValue({ breakpoint: "bp1", condition: "lt" })
      ? phonePeek
      : peek);

  const onChange = (value: number) => {
    draggedSize.value = value;
  };

  const onCommit = async (value: number) => {
    draggedSize.value = value;
    await setUserPreference(SHELF_SIZE_PREFERENCE_KEY, value);
    // a drag that started while it saved keeps its own size
    if (draggedSize.value === value) draggedSize.value = undefined;
  };

  return { size, tilesPerView, onChange, onCommit };
}
