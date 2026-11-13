// The rows of a track table that can be reordered: wires the playlist's
// reorder to the listing's selection, keeps the keyboard focus on a moved
// track, and styles the rows while one is dragged.
import { usePlaylistTrackReorder } from "@/composables/usePlaylistTrackReorder";
import type {
  MediaItemType,
  MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";
import { Ref, computed, nextTick, onBeforeUnmount, toRaw, watch } from "vue";

// frames to wait for the virtual scroller to render a row scrolled into view
const FOCUS_RENDER_FRAMES = 10;

interface TrackReorderRowsOptions {
  // Element holding the rows, anchoring the ghost and the row positions.
  listEl: Ref<HTMLElement | null>;
  // The listed rows.
  items: Ref<MediaItemType[]>;
  // Library id of the playlist the rows belong to.
  playlistId: () => string | undefined;
  // The rows show the playlist's own order with nothing filtered out.
  inOwnOrder: () => boolean;
  // The selected rows; they only count while the rows can be selected.
  selected: Ref<MediaItemTypeOrItemMapping[]>;
  selecting: () => boolean;
  // Height of every row in px; the list is virtualized, so rows are not measured.
  rowHeight: number;
  // Re-reads the listed rows from the provider.
  reload: () => Promise<void>;
}

export function useTrackReorderRows(options: TrackReorderRowsOptions) {
  const { listEl, items, selected, rowHeight } = options;

  const isSelected = (item: MediaItemTypeOrItemMapping) =>
    selected.value.includes(item);
  const selectedIndices = () =>
    options.selecting()
      ? items.value.flatMap((item, index) => (isSelected(item) ? [index] : []))
      : [];

  // the row moved by keyboard and where it went, for the focus to follow it
  // until the order is read back
  let followed: { row: MediaItemType; index: number } | undefined;

  // rows read again are new objects, so the selection and the focus move to
  // the rows that stand for the same items
  const onReloaded = (
    locate: (row: MediaItemType) => MediaItemType | undefined,
  ) => {
    if (selected.value.length) {
      selected.value = selected.value.flatMap((item) => {
        const row = locate(item as MediaItemType);
        return row ? [row] : [];
      });
    }
    if (!followed) return;
    const row = locate(followed.row);
    const index = row ? toRaw(items.value).indexOf(row) : -1;
    if (!row || index === -1) {
      followed = undefined;
      return;
    }
    const wasAt = followed.index;
    followed = { row, index };
    // a failed move reads the old order back; only while the focus is still
    // on the rows
    if (index !== wasAt && listEl.value?.contains(document.activeElement))
      void nextTick(() => focusHandle(index));
  };

  const reorder = usePlaylistTrackReorder({
    listEl,
    items,
    playlistId: options.playlistId,
    inOwnOrder: options.inOwnOrder,
    selectedIndices,
    rowHeight,
    reload: options.reload,
    onReloaded,
    // the selection follows the moved tracks to their new places
    onRowsReplaced: (replacement) => {
      selected.value = selected.value.flatMap((item) => {
        const row = replacement(item as MediaItemType);
        return row ? [row] : [];
      });
    },
  });
  const { draggingIndex, isDragging, rowOffset, saving } = reorder;

  watch(saving, (isSaving) => {
    if (!isSaving) followed = undefined;
  });
  let focusFrame: number | undefined;

  // scroll a row's place into view, rendered or not, as the rows are
  // virtualized; the page scrolls, not the virtual scroller itself
  const scrollRowSlotIntoView = (list: HTMLElement, index: number) => {
    const slot = document.createElement("div");
    slot.style.cssText = `position:absolute;left:0;right:0;top:${index * rowHeight}px;height:${rowHeight}px`;
    list.append(slot);
    slot.scrollIntoView({ block: "nearest" });
    slot.remove();
  };

  const focusHandle = (index: number, framesLeft = FOCUS_RENDER_FRAMES) => {
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    focusFrame = undefined;
    const list = listEl.value;
    if (!list) return;
    const handle = list.querySelector<HTMLElement>(
      `[data-reorder-index="${index}"]`,
    );
    if (handle) {
      handle.focus();
      handle.scrollIntoView({ block: "nearest" });
      return;
    }
    if (framesLeft === FOCUS_RENDER_FRAMES) scrollRowSlotIntoView(list, index);
    if (framesLeft > 0) {
      focusFrame = requestAnimationFrame(() =>
        focusHandle(index, framesLeft - 1),
      );
      return;
    }
    // the focused row now holds another track, which an arrow key would move
    if (list.contains(document.activeElement))
      (document.activeElement as HTMLElement).blur();
  };

  // the rows are keyed by index, so after a keyboard move the focus follows
  // the track to the row it moved to, and to where it is once the order is
  // read back
  const moveBy = (index: number, delta: number) => {
    const movedTo = reorder.moveBy(index, delta);
    if (movedTo === undefined) return;
    followed = { row: toRaw(items.value)[movedTo], index: movedTo };
    void nextTick(() => focusHandle(movedTo));
  };

  const draggedTrack = computed(() =>
    draggingIndex.value === null ? undefined : items.value[draggingIndex.value],
  );
  // grabbing a selected row drags every selected row
  const draggedCount = computed(() => {
    const source = draggingIndex.value;
    if (source === null) return 0;
    const indices = selectedIndices();
    return indices.length > 1 && indices.includes(source) ? indices.length : 1;
  });
  const rowDragStyle = (index: number) =>
    isDragging.value
      ? { transform: `translateY(${rowOffset(index)}px)` }
      : undefined;
  const rowDragClass = (item: MediaItemTypeOrItemMapping, index: number) => {
    // every dragged row leaves the list; the ghost stands in for them all
    const dragged =
      draggingIndex.value === index ||
      (draggedCount.value > 1 && isSelected(item));
    return dragged ? "invisible" : undefined;
  };

  onBeforeUnmount(() => {
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
  });

  return {
    startDrag: reorder.startDrag,
    moveBy,
    refresh: reorder.refresh,
    saving,
    draggingIndex,
    isDragging,
    ghostY: reorder.ghostY,
    draggedTrack,
    draggedCount,
    rowDragStyle,
    rowDragClass,
  };
}
