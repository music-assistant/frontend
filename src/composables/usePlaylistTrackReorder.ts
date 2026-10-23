// Reordering the tracks of a playlist listing by dragging one row or a block
// of selected rows. A move shows at once, is saved on the provider and the
// listed rows are then read again; when saving fails the previous order comes
// back.
import { useListDragReorder } from "@/composables/useListDragReorder";
import {
  blockStartIndex,
  movedOrder,
  moveListedItems,
  playlistPosition,
} from "@/helpers/playlist_reorder";
import { api } from "@/plugins/api";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { Ref, computed, reactive, toRaw, watch } from "vue";

// Counts per playlist id, for moves on their way from outside the playlist's
// listing (such as the track menu), and for every move that is saving or
// being read back; the listed positions are out of date until it is done.
const outsideMoves = reactive(new Map<string, number>());
const savingMoves = reactive(new Map<string, number>());

const hold = (counts: Map<string, number>, id: string) =>
  counts.set(id, (counts.get(id) ?? 0) + 1);
const release = (counts: Map<string, number>, id: string) => {
  const left = (counts.get(id) ?? 1) - 1;
  if (left > 0) counts.set(id, left);
  else counts.delete(id);
};

/** Whether a move of the playlist is saving, or its order is being read back. */
export const isPlaylistMoveSaving = (id: string) => savingMoves.has(id);

/** Send a move from outside the playlist's listing, holding back the listing's own. */
export const sendPlaylistMove = async function (
  id: string,
  move: () => Promise<void>,
) {
  hold(outsideMoves, id);
  hold(savingMoves, id);
  try {
    await move();
  } catch {
    // the api already reports the failure to the user
  } finally {
    release(outsideMoves, id);
    release(savingMoves, id);
  }
};

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
  // Indices of the selected rows; grabbing one of them drags them all.
  selectedIndices: () => number[];
  // Height of every row in px; the list is virtualized, so rows are not measured.
  rowHeight: number;
  // Re-reads the listed rows from the provider.
  reload: () => Promise<void>;
  // Called when rows were replaced by others for the same tracks, with the
  // row that now stands for an old one (undefined when that is unknown).
  onRowsReplaced?: (
    replacement: (row: MediaItemType) => MediaItemType | undefined,
  ) => void;
}

/** Whether the server takes commands, so a move can be saved and read back. */
export const canSavePlaylistMoves = () =>
  api.state.value === ConnectionState.INITIALIZED;

/** Whether an edit of the playlist's order is saving or being read back. */
export const isPlaylistEditPending = (id: string) => pendingEdits.has(id);

export function usePlaylistTrackReorder(options: PlaylistTrackReorderOptions) {
  const { listEl, items, playlistId, inOwnOrder, reload } = options;

  // A move is being saved or read back, here or from outside the listing;
  // another one waits for it, so the reload that follows can't overwrite the
  // newer order.
  const saving = computed(() => {
    const id = playlistId();
    return id !== undefined && isPlaylistMoveSaving(id);
  });

  // Tells the listing which row now stands for each row it held.
  const rowsReplaced = (pairs: Map<MediaItemType, MediaItemType>) =>
    options.onRowsReplaced?.((row) => pairs.get(toRaw(row)));

  // The rows that took the place of `rows` in the listing, by index.
  const rowsByIndex = (rows: MediaItemType[]) => {
    const current = toRaw(items.value);
    return new Map(
      rows.flatMap((row, index) =>
        index < current.length ? [[row, current[index]] as const] : [],
      ),
    );
  };

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

    // the moved rows are copies holding their new positions
    const after = moveListedItems(before, rows, toIndex);
    const order = movedOrder(before.length, rows, toIndex);
    items.value = after;
    rowsReplaced(
      new Map(order.map((from, index) => [before[from], after[index]])),
    );
    hold(savingMoves, id);
    try {
      if (positions.length === 1) {
        await api.movePlaylistTrack(id, positions[0]!, toIndex + 1);
      } else {
        await api.movePlaylistTracks(id, positions as number[], toIndex + 1);
      }
      await reload();
      // a search or sort changed meanwhile puts other rows in the moved ones' place
      if (inOwnOrder()) rowsReplaced(rowsByIndex(after));
      else rowsReplaced(new Map());
    } catch {
      // the api already reports the failure to the user; a load that replaced
      // the rows meanwhile has the order the server holds, and a page loaded
      // meanwhile was appended to the moved rows
      if (toRaw(items.value) === after) {
        items.value = [...before, ...after.slice(before.length)];
      }
      // the provider may have stored part of the move, so read its order
      // back; which rows the selection stood for is then unknown
      rowsReplaced(new Map());
      await reload();
    } finally {
      release(savingMoves, id);
    }
  };

  // A move sent from outside the listing has finished: read the order back
  // before the listed positions are used again.
  watch(
    () => {
      const id = playlistId();
      return id !== undefined && outsideMoves.has(id);
    },
    async (pending, wasPending) => {
      const id = playlistId();
      if (pending || !wasPending || id === undefined) return;
      hold(savingMoves, id);
      try {
        await reload();
      } finally {
        release(savingMoves, id);
      }
    },
    // hold the guard before anything else can run
    { flush: "sync" },
  );

  // Grabbing a selected row moves every selected row.
  const movesBlock = (source: number) => {
    const selected = options.selectedIndices();
    return selected.length > 1 && selected.includes(source);
  };

  // Move the row at `source` to rest at `finalIndex`, taking the selected rows
  // along when it is one of them; returns the row it now is, when it moved.
  const moveFrom = (source: number, finalIndex: number): number | undefined => {
    const before = toRaw(items.value);
    let rows = [source];
    let toIndex = finalIndex;
    if (movesBlock(source)) {
      rows = [...new Set(options.selectedIndices())].sort((a, b) => a - b);
      // the drop slot as an index before the drag lifted the source out
      const dropBefore = finalIndex > source ? finalIndex + 1 : finalIndex;
      toIndex = blockStartIndex(rows, dropBefore);
    }
    void moveRows(rows, toIndex);
    if (toRaw(items.value) === before) return undefined;
    return toIndex + rows.indexOf(source);
  };

  // Move a row one place by keyboard; returns the row it now is, when it moved.
  const moveBy = (index: number, delta: number) =>
    moveFrom(index, index + delta);

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
      void moveFrom(source, finalIndex);
    },
    // a scattered block dropped by its grabbed row still gathers there
    commitsInPlace: (source) => movesBlock(source),
    rowBox: (index) =>
      index >= 0 && index < items.value.length
        ? { top: index * options.rowHeight, height: options.rowHeight }
        : undefined,
  });

  const startDrag = (evt: PointerEvent, index: number) => {
    if (saving.value) return;
    dragRows = toRaw(items.value);
    dragPlaylistId = playlistId();
    drag.startItemDrag(evt, index);
  };

  return {
    ...drag,
    startDrag,
    moveRows,
    moveBy,
    saving,
  };
}
