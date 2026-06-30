// Pointer-driven drag-to-reorder for the fullscreen player's up-next items.
// Built to work with the virtualized list: the source row hides in place, a
// floating "ghost" follows the pointer, and the rows between source and target
// slide aside to reveal the drop position. Only transforms are touched, so the
// virtualizer never re-measures.
import api from "@/plugins/api";
import { QueueItem } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import type { VirtualItem } from "@tanstack/vue-virtual";
import { Ref, computed, onBeforeUnmount, ref } from "vue";

interface QueueDragReorderOptions {
  // Scroll viewport element (the virtualizer's scroll parent).
  scrollEl: Ref<HTMLElement | null>;
  // Reads the currently rendered virtual rows.
  getVirtualItems: () => VirtualItem[];
  // Resolves the (sparsely loaded) queue item at an absolute index.
  itemAt: (index: number) => QueueItem | undefined;
  // Called when a drag begins (e.g. to stop the list following playback).
  onDragStart?: () => void;
}

export function useQueueDragReorder(options: QueueDragReorderOptions) {
  const { scrollEl, getVirtualItems, itemAt, onDragStart } = options;

  // Absolute index of the row being dragged (null when idle) and the index the
  // item would be inserted *before* on drop. While dragging, the source row
  // hides in place, a floating ghost follows the pointer, and the rows between
  // source and target slide aside to reveal where the item will land.
  const dragSourceIndex = ref<number | null>(null);
  const dragDropIndex = ref<number | null>(null);
  // The item being dragged (drives the floating ghost). Captured at drag start.
  const draggedItem = ref<QueueItem | null>(null);
  // Y of the floating ghost's top within the virtual spacer (content space).
  const ghostY = ref(0);
  // Height (px) of the dragged row — the size of the gap the others open up.
  const dragRowHeight = ref(0);
  // Offset between the pointer and the top of the grabbed item, so the ghost
  // keeps the same grip point under the finger instead of jumping.
  let dragGrabOffset = 0;
  // queue_item_id captured at drag start — the item data may be re-fetched
  // mid-drag, so we don't hold on to the object itself.
  let dragItemId: string | null = null;
  // Last pointer Y (viewport px) so the auto-scroll loop can recompute the drop
  // target as the list scrolls under a stationary finger.
  let dragPointerY = 0;
  // Auto-scroll velocity (px/frame) while the pointer sits near an edge.
  let autoScrollSpeed = 0;
  let autoScrollRaf = 0;
  // Lets cleanup detach every drag listener at once (no per-handler bookkeeping).
  let dragAbort: AbortController | null = null;

  const totalItems = () => store.activePlayerQueue?.items ?? 0;

  // First absolute index an up-next item may occupy. Everything up to and
  // including the buffered items is locked (already cued in the stream).
  const firstReorderableIndex = () => {
    const queue = store.activePlayerQueue;
    if (!queue) return 0;
    const current = queue.current_index ?? 0;
    const buffer = Math.max(queue.index_in_buffer ?? current, current);
    return buffer + 1;
  };

  // Resolve the insertion index (drop *before* this absolute index) for a given
  // pointer Y, clamped to the reorderable up-next region.
  const computeDropIndex = (clientY: number): number => {
    const el = scrollEl.value;
    if (!el) return dragDropIndex.value ?? firstReorderableIndex();
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top + el.scrollTop;
    const rows = getVirtualItems();
    let dropIndex = totalItems();
    let matched = false;
    for (const row of rows) {
      if (y < row.start + row.size / 2) {
        dropIndex = row.index;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const last = rows[rows.length - 1];
      dropIndex = last ? last.index + 1 : totalItems();
    }
    const min = firstReorderableIndex();
    return Math.min(Math.max(dropIndex, min), totalItems());
  };

  // Set the auto-scroll velocity from how close the pointer is to an edge.
  const updateAutoScroll = (clientY: number) => {
    const el = scrollEl.value;
    if (!el) {
      autoScrollSpeed = 0;
      return;
    }
    const rect = el.getBoundingClientRect();
    const EDGE = 56; // px from the edge where auto-scroll engages
    const distTop = clientY - rect.top;
    const distBottom = rect.bottom - clientY;
    if (distTop < EDGE) {
      autoScrollSpeed = -Math.ceil((EDGE - distTop) / 5);
    } else if (distBottom < EDGE) {
      autoScrollSpeed = Math.ceil((EDGE - distBottom) / 5);
    } else {
      autoScrollSpeed = 0;
    }
  };

  // Recompute the ghost position and drop target from the current pointer Y.
  const updateDragPositions = (clientY: number) => {
    dragPointerY = clientY;
    const el = scrollEl.value;
    if (el) {
      const rect = el.getBoundingClientRect();
      ghostY.value = clientY - rect.top + el.scrollTop - dragGrabOffset;
    }
    dragDropIndex.value = computeDropIndex(clientY);
  };

  function autoScrollFrame() {
    if (dragSourceIndex.value == null) return;
    const el = scrollEl.value;
    if (autoScrollSpeed !== 0 && el) {
      el.scrollTop += autoScrollSpeed;
      updateDragPositions(dragPointerY);
    }
    autoScrollRaf = requestAnimationFrame(autoScrollFrame);
  }

  const onDragPointerMove = (evt: PointerEvent) => {
    if (dragSourceIndex.value == null) return;
    evt.preventDefault();
    updateAutoScroll(evt.clientY);
    updateDragPositions(evt.clientY);
  };

  const cleanupDrag = () => {
    dragAbort?.abort();
    dragAbort = null;
    if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
    autoScrollRaf = 0;
    autoScrollSpeed = 0;
    dragSourceIndex.value = null;
    dragDropIndex.value = null;
    draggedItem.value = null;
    dragRowHeight.value = 0;
    dragGrabOffset = 0;
    dragItemId = null;
  };

  const finishDrag = (commit: boolean) => {
    const source = dragSourceIndex.value;
    const drop = dragDropIndex.value;
    const itemId = dragItemId;
    const queue = store.activePlayerQueue;
    cleanupDrag();
    if (!commit || source == null || drop == null || itemId == null || !queue)
      return;
    // Removing the source first shifts everything after it down by one, so the
    // final resting index is one lower when dropping below the original spot.
    const finalIndex = drop > source ? drop - 1 : drop;
    const shift = finalIndex - source;
    if (shift === 0) return;
    api.queueCommandMoveItem(queue.queue_id, itemId, shift);
  };

  // Begin dragging an up-next row from its drag handle.
  const startItemDrag = (evt: PointerEvent, index: number) => {
    // Primary mouse button / touch / pen only.
    if (evt.pointerType === "mouse" && evt.button !== 0) return;
    const item = itemAt(index);
    if (!item || index < firstReorderableIndex()) return;

    // Measure the grabbed item so the ghost lines up under the finger and the
    // gap the other rows open matches the item's height. Fall back to the
    // virtualizer's measurement if the element can't be resolved.
    const el = scrollEl.value;
    const qitemEl = (evt.target as HTMLElement | null)?.closest(".qitem");
    if (el && qitemEl) {
      const cRect = el.getBoundingClientRect();
      const qRect = qitemEl.getBoundingClientRect();
      const qTop = qRect.top - cRect.top + el.scrollTop;
      dragRowHeight.value = qRect.height;
      dragGrabOffset = evt.clientY - cRect.top + el.scrollTop - qTop;
      ghostY.value = qTop;
    } else {
      const vItem = getVirtualItems().find((v) => v.index === index);
      dragRowHeight.value = vItem?.size ?? 60;
      dragGrabOffset = dragRowHeight.value / 2;
      ghostY.value = (vItem?.start ?? 0) + dragRowHeight.value / 2;
    }

    dragSourceIndex.value = index;
    dragDropIndex.value = index;
    draggedItem.value = item;
    dragItemId = item.queue_item_id;
    dragPointerY = evt.clientY;
    autoScrollSpeed = 0;
    onDragStart?.();
    dragAbort = new AbortController();
    const { signal } = dragAbort;
    window.addEventListener("pointermove", onDragPointerMove, {
      passive: false,
      signal,
    });
    window.addEventListener("pointerup", () => finishDrag(true), { signal });
    window.addEventListener("pointercancel", () => finishDrag(false), {
      signal,
    });
    autoScrollRaf = requestAnimationFrame(autoScrollFrame);
  };

  // Index of the row currently being dragged (the hidden source row).
  const draggingIndex = computed(() => dragSourceIndex.value);

  // Whether a reorder drag is in progress (drives the ghost + gap rendering).
  const isDragging = computed(() => dragSourceIndex.value !== null);

  // Extra Y offset for a visible row so the rows between the source and the
  // drop target slide aside, opening a gap the size of the dragged row exactly
  // where it will land. Returns 0 for everything else (incl. the source row).
  const rowOffset = (index: number): number => {
    const source = dragSourceIndex.value;
    const drop = dragDropIndex.value;
    if (source == null || drop == null || index === source) return 0;
    const height = dragRowHeight.value;
    // Dragging down: rows below the source and above the target shift up.
    if (drop > source && index > source && index < drop) return -height;
    // Dragging up: rows from the target down to the source shift down.
    if (drop < source && index >= drop && index < source) return height;
    return 0;
  };

  onBeforeUnmount(cleanupDrag);

  return {
    startItemDrag,
    draggingIndex,
    isDragging,
    draggedItem,
    ghostY,
    rowOffset,
  };
}
