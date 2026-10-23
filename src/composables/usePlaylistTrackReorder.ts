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
import { Ref, computed, reactive, ref, toRaw, watch } from "vue";

// Playlists with moves on their way from outside their listing, such as the
// track menu, by id; the listed positions are out of date until read back.
const outsideMoves = reactive(new Map<string, number>());

/** Send a move from outside the playlist's listing, holding back the listing's own. */
export const sendPlaylistMove = async function (
  id: string,
  move: () => Promise<void>,
) {
  outsideMoves.set(id, (outsideMoves.get(id) ?? 0) + 1);
  try {
    await move();
  } catch {
    // the api already reports the failure to the user
  } finally {
    const left = (outsideMoves.get(id) ?? 1) - 1;
    if (left > 0) outsideMoves.set(id, left);
    else outsideMoves.delete(id);
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

  // A move is being saved, here or from outside the listing; another one
  // waits for it, so the reload that follows can't overwrite the newer order.
  const savingHere = ref(false);
  const saving = computed(() => {
    const id = playlistId();
    return savingHere.value || (id !== undefined && outsideMoves.has(id));
  });

  // Tells the listing which row now stands for each row it held.
  const rowsReplaced = (pairs: Map<MediaItemType, MediaItemType>) =>
    options.onRowsReplaced?.((row) => pairs.get(row));

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
    savingHere.value = true;
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
      savingHere.value = false;
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
      if (pending || !wasPending) return;
      savingHere.value = true;
      try {
        await reload();
      } finally {
        savingHere.value = false;
      }
    },
  );

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
      const selected = options.selectedIndices();
      if (selected.length > 1 && selected.includes(source)) {
        // the drop slot as an index before the drag lifted the source out
        const dropBefore = finalIndex > source ? finalIndex + 1 : finalIndex;
        void moveRows(selected, blockStartIndex(selected, dropBefore));
      } else {
        void moveRows([source], finalIndex);
      }
    },
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
    saving,
  };
}
