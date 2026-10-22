// Drag-to-reorder for the tracks of a playlist listing. A drop moves the row
// straight away, saves the new order on the provider and then re-reads the
// listed rows; when saving fails the previous order comes back.
import { useListDragReorder } from "@/composables/useListDragReorder";
import { moveListedItem, playlistPosition } from "@/helpers/playlist_reorder";
import { api } from "@/plugins/api";
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
  // Re-reads the listed rows once the provider holds the new order.
  reload: () => Promise<void>;
}

export function usePlaylistTrackReorder(options: PlaylistTrackReorderOptions) {
  const { listEl, items, playlistId, rowHeight, reload } = options;

  // A move is being saved; another drag waits for it, so the reload that
  // follows can't overwrite the newer order.
  const saving = ref(false);

  const move = async function (from: number, to: number) {
    const id = playlistId();
    const before = toRaw(items.value);
    if (id === undefined || saving.value || from === to) return;
    if (to < 0 || to >= before.length) return;
    const fromPosition = playlistPosition(before[from]);
    const toPosition = playlistPosition(before[to]);
    if (fromPosition === undefined || toPosition === undefined) return;

    const after = moveListedItem(before, from, to);
    items.value = after;
    saving.value = true;
    try {
      await api.movePlaylistTrack(id, fromPosition, toPosition);
      await reload();
    } catch {
      // the api already reports the failure to the user; a load that replaced
      // the rows meanwhile has the order the server holds
      if (toRaw(items.value) === after) items.value = before;
    } finally {
      saving.value = false;
    }
  };

  const drag = useListDragReorder({
    listEl,
    count: () => items.value.length,
    onCommit: (from, to) => void move(from, to),
    rowBox: (index) =>
      index >= 0 && index < items.value.length
        ? { top: index * rowHeight, height: rowHeight }
        : undefined,
  });

  // Begin dragging a row from its handle, unless a move is still saving.
  const startDrag = (evt: PointerEvent, index: number) => {
    if (saving.value) return;
    drag.startItemDrag(evt, index);
  };

  return {
    ...drag,
    startDrag,
    move,
    saving,
  };
}
