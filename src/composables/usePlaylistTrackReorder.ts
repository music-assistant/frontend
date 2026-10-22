// Reordering the tracks of a playlist listing: dragging one row or a block of
// selected rows, and moving items to the playlist's top or bottom. While the
// listing shows the playlist's own order, a move shows at once, is saved on
// the provider and the listed rows are then read again; when saving fails the
// previous order comes back.
import { useListDragReorder } from "@/composables/useListDragReorder";
import {
  blockStartIndex,
  moveListedItems,
  playlistPosition,
} from "@/helpers/playlist_reorder";
import { api } from "@/plugins/api";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { Ref, computed, reactive, toRaw } from "vue";

// Counts per playlist id of the edits that are saving or being read back; the
// listed positions are out of date until they are done.
const pendingEdits = reactive(new Map<string, number>());

const hold = (counts: Map<string, number>, id: string) =>
  counts.set(id, (counts.get(id) ?? 0) + 1);
const release = (counts: Map<string, number>, id: string) => {
  const left = (counts.get(id) ?? 1) - 1;
  if (left > 0) counts.set(id, left);
  else counts.delete(id);
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
  // Every row of the playlist is listed.
  allLoaded: () => boolean;
  // Indices of the selected rows; grabbing one of them drags them all.
  selectedIndices: () => number[];
  // Height of every row in px; the list is virtualized, so rows are not measured.
  rowHeight: number;
  // Re-reads the listed rows from the provider.
  reload: () => Promise<void>;
  // Called after a move with the block's new first index and its size, or
  // with undefined when the rows were not in the playlist's own order.
  onMoved?: (toIndex: number | undefined, count: number) => void;
}

/** Whether the server takes commands, so a move can be saved and read back. */
export const canSavePlaylistMoves = () =>
  api.state.value === ConnectionState.INITIALIZED;

/** Whether an edit of the playlist's order is saving or being read back. */
export const isPlaylistEditPending = (id: string) => pendingEdits.has(id);

export function usePlaylistTrackReorder(options: PlaylistTrackReorderOptions) {
  const { listEl, items, playlistId, inOwnOrder, allLoaded } = options;

  // A move is being saved; another one waits for it, so the reload that
  // follows can't overwrite the newer order.
  const saving = ref(false);
  // the playlist changed while its rows were being read back
  let changedMeanwhile = false;

  // Saves a move, if any, and reads the rows back while holding off other
  // moves; a change reported meanwhile is read back as well.
  const settle = async function (save?: () => Promise<void>) {
    if (settling) {
      changedMeanwhile = true;
      return;
    }
    const id = playlistId();
    settling = true;
    if (id !== undefined) hold(pendingEdits, id);
    try {
      try {
        await save?.();
      } catch {
        // the api already reports the failure to the user; the provider may
        // have stored part of the move, so its order is read back all the same
      }
      do {
        changedMeanwhile = false;
        await reload();
        options.onReloaded?.();
      } while (changedMeanwhile);
    } finally {
      settling = false;
      if (id !== undefined) release(pendingEdits, id);
    }
  };

  // Reads the rows back after the playlist changed.
  const refresh = () => settle();

  // Save a move and read the rows back, restoring `before` when it fails.
  const save = async function (
    id: string,
    positions: number[],
    toPosition: number,
    optimistic?: { before: MediaItemType[]; after: MediaItemType[] },
  ): Promise<boolean> {
    saving.value = true;
    try {
      if (positions.length === 1) {
        await api.movePlaylistTrack(id, positions[0], toPosition);
      } else {
        await api.movePlaylistTracks(id, positions, toPosition);
      }
      await options.reload();
      return true;
    } catch {
      // the api already reports the failure to the user; a load that replaced
      // the rows meanwhile has the order the server holds
      if (optimistic && toRaw(items.value) === optimistic.after) {
        items.value = optimistic.before;
      }
      return false;
    } finally {
      saving.value = false;
    }
  };

  /** Move the rows at `indices` as one block that starts at row `toIndex`. */
  const moveRows = async function (indices: number[], toIndex: number) {
    const id = playlistId();
    const before = toRaw(items.value);
    const rows = [...new Set(indices)].sort((a, b) => a - b);
    if (id === undefined || saving.value || !inOwnOrder() || !rows.length)
      return;
    if (toIndex < 0 || toIndex + rows.length > before.length) return;
    if (rows.every((row, offset) => row === toIndex + offset)) return;
    const positions = rows.map((row) => playlistPosition(before[row]));
    if (positions.some((position) => position === undefined)) return;

    const after = moveListedItems(before, rows, toIndex);
    items.value = after;
    if (await save(id, positions as number[], toIndex + 1, { before, after })) {
      options.onMoved?.(toIndex, rows.length);
    }
  };

  // Number of tracks in the whole playlist.
  const playlistLength = async function (id: string) {
    if (inOwnOrder() && allLoaded()) return items.value.length;
    const tracks = await api.getPlaylistTracks(
      id,
      "library",
      false,
      undefined,
      undefined,
      0,
    );
    return tracks.length;
  };

  /** Move the items at these playlist positions to its top or bottom. */
  const moveToEdge = async function (
    positions: number[],
    edge: "top" | "bottom",
  ) {
    const id = playlistId();
    if (id === undefined || saving.value || !positions.length) return;
    const unique = [...new Set(positions)].sort((a, b) => a - b);
    let toPosition = 1;
    if (edge === "bottom") {
      try {
        toPosition = (await playlistLength(id)) - unique.length + 1;
      } catch {
        // the api already reports the failure to the user
        return;
      }
    }
    if (inOwnOrder() && allLoaded()) {
      await moveRows(
        unique.map((position) => position - 1),
        toPosition - 1,
      );
    } else if (await save(id, unique, toPosition)) {
      options.onMoved?.(undefined, unique.length);
    }
  };

  // Move a row one place by keyboard; returns the row it now is, when it moved.
  const moveBy = (index: number, delta: number): number | undefined => {
    const before = toRaw(items.value);
    void moveRows([index], index + delta);
    return toRaw(items.value) === before ? undefined : index + delta;
  };

  const drag = useListDragReorder({
    listEl,
    count: () => items.value.length,
    onCommit: (source, finalIndex) => {
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
    drag.startItemDrag(evt, index);
  };

  return {
    ...drag,
    startDrag,
    moveRows,
    moveToEdge,
    moveBy,
    refresh,
    saving,
  };
}
