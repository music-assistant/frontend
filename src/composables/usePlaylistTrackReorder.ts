// Reordering the tracks of a playlist listing by dragging one row or a block
// of selected rows. A move shows at once and is saved on the provider; nothing
// moves or removes the playlist's tracks again until the listed rows are read
// back, failed or not, so every listed position is the provider's.
import { useListDragReorder } from "@/composables/useListDragReorder";
import {
  blockStartIndex,
  movedOrder,
  moveListedItems,
  playlistPosition,
} from "@/helpers/playlist_reorder";
import { api, ConnectionState } from "@/plugins/api";
import {
  EventType,
  TaskStatus,
  type BackgroundTask,
  type EventMessage,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { Ref, computed, reactive, toRaw, watch } from "vue";

const FINISHED_TASK_STATUSES = new Set([
  TaskStatus.SUCCESS,
  TaskStatus.PARTIAL_SUCCESS,
  TaskStatus.FAILED,
  TaskStatus.CANCELLED,
]);
/**
 * Resolves once a background task has finished, is no longer listed, or the
 * connection to the server was made again. Its end can't be looked up without
 * the right to read every task, and a report sent while disconnected is lost,
 * so a reconnect ends the wait and the rows are read back instead.
 */
export const untilTaskEnds = (task: BackgroundTask) =>
  new Promise<void>((resolve) => {
    if (FINISHED_TASK_STATUSES.has(task.status)) {
      resolve();
      return;
    }
    const stop = () => {
      unsubscribe();
      stopWatchingConnection();
      resolve();
    };
    const stopWatchingConnection = watch(
      () => api.state.value,
      (state) => {
        if (state === ConnectionState.INITIALIZED) stop();
      },
    );
    const unsubscribe = api.subscribe(
      EventType.TASKS_UPDATED,
      (event: EventMessage) => {
        const current = (event.data as BackgroundTask[]).find(
          (listed) => listed.id === task.id,
        );
        if (!current || FINISHED_TASK_STATUSES.has(current.status)) stop();
      },
    ) as () => void;
  });

// Counts per playlist id, for edits on their way from outside the playlist's
// listing (such as the track menu), and for every edit that is saving or
// being read back; the listed positions are out of date until it is done.
const outsideEdits = reactive(new Map<string, number>());
const pendingEdits = reactive(new Map<string, number>());

const hold = (counts: Map<string, number>, id: string) =>
  counts.set(id, (counts.get(id) ?? 0) + 1);
const release = (counts: Map<string, number>, id: string) => {
  const left = (counts.get(id) ?? 1) - 1;
  if (left > 0) counts.set(id, left);
  else counts.delete(id);
};

/** Whether the server takes commands, so a move can be saved and read back. */
export const canSavePlaylistMoves = () =>
  api.state.value === ConnectionState.INITIALIZED;

/** Whether an edit of the playlist's order is saving or being read back. */
export const isPlaylistEditPending = (id: string) => pendingEdits.has(id);

/**
 * Send an edit of the playlist's order from outside its listing, such as a
 * move or removal from the track menu; the listing reads its rows back once
 * it is done and holds back its own moves until then.
 */
export const sendPlaylistEdit = async function (
  id: string,
  edit: () => Promise<unknown>,
) {
  // an edit sent while reconnecting fails, and its rows could not be read back
  if (!canSavePlaylistMoves()) return;
  hold(outsideEdits, id);
  hold(pendingEdits, id);
  try {
    await edit();
  } catch {
    // the api already reports the failure to the user
  } finally {
    // the listing takes over the hold before this one ends
    release(outsideEdits, id);
    release(pendingEdits, id);
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
  // Called each time the rows were read back.
  onReloaded?: () => void;
  // Called when a move replaced rows by copies at their new places, with the
  // row that now stands for an old one.
  onRowsReplaced?: (
    replacement: (row: MediaItemType) => MediaItemType | undefined,
  ) => void;
}

export function usePlaylistTrackReorder(options: PlaylistTrackReorderOptions) {
  const { listEl, items, playlistId, inOwnOrder, reload } = options;

  // An edit is saving or being read back, here or from outside the listing;
  // another move waits, so it never starts from positions the provider no
  // longer holds.
  const saving = computed(() => {
    const id = playlistId();
    return id !== undefined && isPlaylistEditPending(id);
  });

  // this listing is reading its rows back, and the playlist changed meanwhile
  let settling = false;
  let changedMeanwhile = false;

  // Saves a move, if any, and reads the rows back while holding off other
  // edits; a change reported meanwhile is read back as well.
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

  // An edit sent from outside the listing has finished: read the order back
  // before the listed positions are used again.
  watch(
    () => {
      const id = playlistId();
      return id !== undefined && outsideEdits.has(id);
    },
    (pending, wasPending) => {
      if (!pending && wasPending) void settle();
    },
    // take over the hold before the edit releases it
    { flush: "sync" },
  );

  const moveRows = async function (indices: number[], toIndex: number) {
    const id = playlistId();
    const before = toRaw(items.value);
    const rows = [...new Set(indices)].sort((a, b) => a - b);
    if (id === undefined || saving.value || !inOwnOrder() || !rows.length)
      return;
    if (!canSavePlaylistMoves()) return;
    if (rows[0] < 0 || rows[rows.length - 1] >= before.length) return;
    if (toIndex < 0 || toIndex + rows.length > before.length) return;
    if (rows.every((row, offset) => row === toIndex + offset)) return;
    const positions = rows.map((row) => playlistPosition(before[row]));
    if (positions.some((position) => position === undefined)) return;

    // the moved rows are copies holding their new positions
    const after = moveListedItems(before, rows, toIndex);
    const order = movedOrder(before.length, rows, toIndex);
    items.value = after;
    const pairs = new Map(
      order.map((from, index) => [before[from], after[index]]),
    );
    options.onRowsReplaced?.((row) => pairs.get(toRaw(row)));
    await settle(() =>
      positions.length === 1
        ? api.movePlaylistTrack(id, positions[0]!, toIndex + 1)
        : api.movePlaylistTracks(id, positions as number[], toIndex + 1),
    );
  };

  // Grabbing a selected row moves every selected row.
  const movesBlock = (source: number) => {
    const selected = options.selectedIndices();
    return selected.length > 1 && selected.includes(source);
  };
  const rowsMovedBy = (source: number) =>
    movesBlock(source)
      ? [...new Set(options.selectedIndices())].sort((a, b) => a - b)
      : [source];

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

  // Move a row, or the block it is in, one place by keyboard; returns the row
  // it now is, when it moved.
  const moveBy = (index: number, delta: number) => {
    const rows = rowsMovedBy(index);
    // the block steps past the row beyond its edge in that direction
    const edge =
      delta > 0 ? rows[rows.length - 1] + 1 + delta : rows[0] + delta;
    const dropBefore = Math.min(Math.max(edge, 0), items.value.length);
    return moveFrom(index, rows, blockStartIndex(rows, dropBefore));
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
    refresh,
    saving,
  };
}
