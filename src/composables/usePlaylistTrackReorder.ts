// Reordering the tracks of a playlist listing by dragging one row or a block
// of selected rows. A move shows at once and is saved on the provider, then
// the rows are read back, failed or not. The server refuses a move whose
// positions no longer hold the listed tracks.
import { useListDragReorder } from "@/composables/useListDragReorder";
import {
  blockStartIndex,
  movedOrder,
  moveListedItems,
  playlistPosition,
  reloadedRowLocator,
} from "@/helpers/playlist_reorder";
import { api } from "@/plugins/api";
import type {
  MediaItemType,
  MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";
import { Ref, computed, nextTick, onBeforeUnmount, ref, toRaw } from "vue";

// frames to wait for the virtual scroller to render a row scrolled into view
const FOCUS_RENDER_FRAMES = 10;

interface PlaylistTrackReorderOptions {
  // Element holding the rows, anchoring the ghost and the row positions.
  listEl: Ref<HTMLElement | null>;
  // The listed rows.
  items: Ref<MediaItemType[]>;
  // Library id of the playlist the rows belong to.
  playlistId: () => string | undefined;
  // The rows show the playlist's own order with nothing filtered out, so a
  // row's index is its position minus one.
  inOwnOrder: () => boolean;
  // The selected rows; they only count while the rows can be selected.
  // Grabbing one of them drags them all.
  selected: Ref<MediaItemTypeOrItemMapping[]>;
  selecting: () => boolean;
  // Height of every row in px; the list is virtualized, so rows are not measured.
  rowHeight: number;
  // Re-reads the listed rows from the provider.
  reload: () => Promise<void>;
}

export function usePlaylistTrackReorder(options: PlaylistTrackReorderOptions) {
  const { listEl, items, playlistId, inOwnOrder, selected, rowHeight, reload } =
    options;

  const isSelected = (item: MediaItemTypeOrItemMapping) =>
    selected.value.includes(item);
  const selectedIndices = () =>
    options.selecting()
      ? items.value.flatMap((item, index) => (isSelected(item) ? [index] : []))
      : [];
  // the selection moves to the rows that stand for the same items
  const reselect = (
    locate: (row: MediaItemType) => MediaItemType | undefined,
  ) => {
    if (!selected.value.length) return;
    selected.value = selected.value.flatMap((item) => {
      const row = locate(toRaw(item) as MediaItemType);
      return row ? [row] : [];
    });
  };

  // a move of this listing is saving or being read back; another one waits
  const saving = ref(false);

  // the row moved by keyboard and where it went, for the focus to follow it
  // until the order is read back
  let followed: { row: MediaItemType; index: number } | undefined;

  // rows read again are new objects, so the selection and the focus move to
  // the rows that stand for the same items; after a failed move they are let go
  const onReloaded = (failed: boolean) => {
    const locate = reloadedRowLocator(toRaw(items.value));
    if (failed) {
      selected.value = [];
      // the focus goes back to the moved track, unless it is listed twice
      const uri = followed?.row.uri;
      followed = undefined;
      if (uri === undefined || !listEl.value?.contains(document.activeElement))
        return;
      const found = items.value.flatMap((row, index) =>
        row.uri === uri ? [index] : [],
      );
      if (found.length === 1) void nextTick(() => focusHandle(found[0]));
      else (document.activeElement as HTMLElement).blur();
      return;
    }
    reselect(locate);
    if (!followed) return;
    const row = locate(followed.row);
    const index = row ? toRaw(items.value).indexOf(row) : -1;
    if (!row || index === -1) {
      followed = undefined;
      return;
    }
    const wasAt = followed.index;
    followed = { row, index };
    if (index !== wasAt && listEl.value?.contains(document.activeElement))
      void nextTick(() => focusHandle(index));
  };

  // the playlist changed while this listing read its rows back
  let changedMeanwhile = false;

  // Saves a move, if any, and reads the rows back while holding off other
  // edits; a change reported meanwhile is read back as well.
  const settle = async function (save?: () => Promise<void>) {
    if (saving.value) {
      changedMeanwhile = true;
      return;
    }
    saving.value = true;
    try {
      let failed = false;
      try {
        await save?.();
      } catch {
        // the api already reports the failure to the user; the provider may
        // have stored part of the move, so its order is read back all the same
        failed = true;
      }
      do {
        changedMeanwhile = false;
        await reload();
        onReloaded(failed);
        failed = false;
      } while (changedMeanwhile);
    } finally {
      saving.value = false;
      followed = undefined;
    }
  };

  // Reads the rows back after the playlist changed.
  const refresh = () => settle();

  const moveRows = async function (indices: number[], toIndex: number) {
    const id = playlistId();
    const before = toRaw(items.value);
    const rows = [...new Set(indices)].sort((a, b) => a - b);
    if (id === undefined || saving.value || !inOwnOrder() || !rows.length)
      return;
    if (rows[0] < 0 || rows[rows.length - 1] >= before.length) return;
    if (toIndex < 0 || toIndex + rows.length > before.length) return;
    if (rows.every((row, offset) => row === toIndex + offset)) return;
    const positions = rows.map((row) => playlistPosition(before[row]));
    if (positions.some((position) => position === undefined)) return;

    // the moved rows are copies holding their new positions, and the
    // selection follows them
    const after = moveListedItems(before, rows, toIndex);
    const order = movedOrder(before.length, rows, toIndex);
    items.value = after;
    const pairs = new Map(
      order.map((from, index) => [before[from], after[index]]),
    );
    reselect((row) => pairs.get(row));
    const uris = rows.map((row) => before[row].uri);
    await settle(() =>
      positions.length === 1
        ? api.movePlaylistTrack(id, positions[0]!, toIndex + 1, uris[0])
        : api.movePlaylistTracks(id, positions as number[], toIndex + 1, uris),
    );
  };

  // Grabbing a selected row moves every selected row.
  const movesBlock = (source: number) => {
    const indices = selectedIndices();
    return indices.length > 1 && indices.includes(source);
  };
  const rowsMovedBy = (source: number) =>
    movesBlock(source) ? selectedIndices() : [source];

  // Move `rows` to start at `toIndex`; returns the row the one at `source`
  // now is, when they moved.
  const moveFrom = (
    source: number,
    rows: number[],
    toIndex: number,
  ): number | undefined => {
    const before = toRaw(items.value);
    void moveRows(rows, toIndex);
    if (toRaw(items.value) === before) return undefined;
    return toIndex + rows.indexOf(source);
  };

  // A drag dropped the row at `source` to rest at `finalIndex`.
  const dropAt = (source: number, finalIndex: number) => {
    const rows = rowsMovedBy(source);
    // the drop slot as an index before the drag lifted the source out
    const dropBefore = finalIndex > source ? finalIndex + 1 : finalIndex;
    return moveFrom(source, rows, blockStartIndex(rows, dropBefore));
  };

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

  // Move a row, or the block it is in, one place by keyboard; returns the row
  // it now is, when it moved. The rows are keyed by index, so the focus
  // follows the track to the row it moved to, and to where it is once the
  // order is read back.
  const moveBy = (index: number, delta: number) => {
    const rows = rowsMovedBy(index);
    // the block steps past the row beyond its edge in that direction
    const edge =
      delta > 0 ? rows[rows.length - 1] + 1 + delta : rows[0] + delta;
    const dropBefore = Math.min(Math.max(edge, 0), items.value.length);
    const movedTo = moveFrom(index, rows, blockStartIndex(rows, dropBefore));
    if (movedTo === undefined) return undefined;
    followed = { row: toRaw(items.value)[movedTo], index: movedTo };
    void nextTick(() => focusHandle(movedTo));
    return movedTo;
  };

  // The rows and playlist a drag started on; a drop on a listing that was
  // replaced meanwhile would move a different track.
  let dragRows: MediaItemType[] | undefined;
  let dragPlaylistId: string | undefined;

  const drag = useListDragReorder({
    listEl,
    count: () => items.value.length,
    onCommit: (source, finalIndex) => {
      if (toRaw(items.value) !== dragRows) return;
      if (playlistId() !== dragPlaylistId) return;
      void dropAt(source, finalIndex);
    },
    rowBox: (index) =>
      index >= 0 && index < items.value.length
        ? { top: index * rowHeight, height: rowHeight }
        : undefined,
  });
  const { draggingIndex, isDragging, rowOffset } = drag;

  const startDrag = (evt: PointerEvent, index: number) => {
    if (saving.value) return;
    dragRows = toRaw(items.value);
    dragPlaylistId = playlistId();
    drag.startItemDrag(evt, index);
  };

  const draggedTrack = computed(() =>
    draggingIndex.value === null ? undefined : items.value[draggingIndex.value],
  );
  const draggedCount = computed(() => {
    const source = draggingIndex.value;
    return source !== null && movesBlock(source) ? selectedIndices().length : 1;
  });
  const rowDragStyle = (index: number) =>
    isDragging.value
      ? { transform: `translateY(${rowOffset(index)}px)` }
      : undefined;
  const rowDragClass = (item: MediaItemTypeOrItemMapping, index: number) => {
    if (draggingIndex.value === index) return "invisible";
    if (draggedCount.value > 1 && isSelected(item)) return "opacity-40";
    return undefined;
  };

  onBeforeUnmount(() => {
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
  });

  return {
    startDrag,
    moveRows,
    moveBy,
    refresh,
    saving,
    draggingIndex,
    isDragging,
    ghostY: drag.ghostY,
    draggedTrack,
    draggedCount,
    rowDragStyle,
    rowDragClass,
  };
}
