// Drag-to-reorder for the tracks of a playlist listing. A drop moves the row
// straight away and saves the new order on the provider; nothing moves the
// rows again until they are read back, failed or not, so every listed
// position is the provider's.
import { useListDragReorder } from "@/composables/useListDragReorder";
import { moveListedItem, playlistPosition } from "@/helpers/playlist_reorder";
import { api, ConnectionState } from "@/plugins/api";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { Ref, ref, toRaw } from "vue";

interface PlaylistTrackReorderOptions {
  // Element holding the rows, anchoring the ghost and the row positions.
  listEl: Ref<HTMLElement | null>;
  // The listed rows, in the playlist's own order.
  items: Ref<MediaItemType[]>;
  // Library id of the playlist the rows belong to.
  playlistId: () => string | undefined;
  // Height of every row in px; the list is virtualized, so rows are not measured.
  rowHeight: number;
  // Re-reads the listed rows from the provider.
  reload: () => Promise<void>;
  // Called each time the rows were read back.
  onReloaded?: () => void;
}

/** Whether the server takes commands, so a move can be saved and read back. */
export const canSavePlaylistMoves = () =>
  api.state.value === ConnectionState.INITIALIZED;

export function usePlaylistTrackReorder(options: PlaylistTrackReorderOptions) {
  const { listEl, items, playlistId, rowHeight, reload } = options;

  // A move is saving or the rows are being read back; another move waits, so
  // it never starts from positions the provider no longer holds.
  const saving = ref(false);
  // the playlist changed while its rows were being read back
  let changedMeanwhile = false;

  // Saves a move, if any, and reads the rows back while holding off other
  // moves; a change reported meanwhile is read back as well.
  const settle = async function (save?: () => Promise<void>) {
    if (saving.value) {
      changedMeanwhile = true;
      return;
    }
    saving.value = true;
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
      saving.value = false;
    }
  };

  // Reads the rows back after the playlist changed.
  const refresh = () => settle();

  const move = async function (from: number, to: number) {
    const id = playlistId();
    const before = toRaw(items.value);
    if (id === undefined || saving.value || from === to) return;
    if (!canSavePlaylistMoves()) return;
    if (from < 0 || from >= before.length) return;
    if (to < 0 || to >= before.length) return;
    const fromPosition = playlistPosition(before[from]);
    const toPosition = playlistPosition(before[to]);
    if (fromPosition === undefined || toPosition === undefined) return;

    items.value = moveListedItem(before, from, to);
    await settle(() => api.movePlaylistTrack(id, fromPosition, toPosition));
  };

  // The rows and playlist a drag started on; a drop on a listing that was
  // replaced meanwhile would move a different track.
  let dragRows: MediaItemType[] | undefined;
  let dragPlaylistId: string | undefined;

  // Move a row one place by keyboard; returns the row it now is, when it moved.
  const moveBy = (index: number, delta: number): number | undefined => {
    const before = toRaw(items.value);
    void move(index, index + delta);
    return toRaw(items.value) === before ? undefined : index + delta;
  };

  const drag = useListDragReorder({
    listEl,
    count: () => items.value.length,
    onCommit: (from, to) => {
      if (toRaw(items.value) !== dragRows) return;
      if (playlistId() !== dragPlaylistId) return;
      void move(from, to);
    },
    rowBox: (index) =>
      index >= 0 && index < items.value.length
        ? { top: index * rowHeight, height: rowHeight }
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
    move,
    moveBy,
    refresh,
    saving,
  };
}
