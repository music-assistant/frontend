// Pointer-driven drag-to-reorder for sidebar shortcuts.
// Inspired by useQueueDragReorder but adapted for non-virtualized list and
// simpler requirements (all items are draggable, no sections).
import {
  type ShortcutItem,
  reorderShortcutStandalone,
  getShortcutUri,
} from "@/composables/useShortcuts";
import { Ref, computed, onBeforeUnmount, ref } from "vue";

interface ShortcutDragReorderOptions {
  // The shortcuts container element (the scroll parent).
  scrollEl: Ref<HTMLElement | null>;
  // Resolves the shortcut item at an index.
  itemAt: (index: number) => ShortcutItem | undefined;
  // Total number of shortcuts.
  totalCount: () => number;
  // Called when a drag begins.
  onDragStart?: () => void;
}

export function useShortcutDragReorder(options: ShortcutDragReorderOptions) {
  const { scrollEl, itemAt, totalCount, onDragStart } = options;

  // Index of the row being dragged (null when idle) and the index the
  // item would be inserted *before* on drop.
  const dragSourceIndex = ref<number | null>(null);
  const dragDropIndex = ref<number | null>(null);
  // The item being dragged (drives the floating ghost). Captured at drag start.
  const draggedItem = ref<ShortcutItem | null>(null);
  // Y of the floating ghost's top within the scroll container (content space).
  const ghostY = ref(0);
  // Height (px) of the dragged row — the size of the gap the others open up.
  const dragRowHeight = ref(0);
  // Offset between the pointer and the top of the grabbed item.
  let dragGrabOffset = 0;
  // URI captured at drag start for the reorder API call.
  let dragItemUri: string | null = null;
  // Last pointer Y (viewport px) for auto-scroll recomputation.
  let dragPointerY = 0;
  // Auto-scroll velocity (px/frame) while pointer sits near an edge.
  let autoScrollSpeed = 0;
  let autoScrollRaf = 0;
  // Lets cleanup detach every drag listener at once.
  let dragAbort: AbortController | null = null;

  // Resolve the insertion index (drop *before* this index) for a given pointer Y.
  const computeDropIndex = (clientY: number): number => {
    const el = scrollEl.value;
    if (!el) return dragDropIndex.value ?? 0;

    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top + el.scrollTop;

    // Find all shortcut items in the DOM
    const items = el.querySelectorAll("[data-shortcut-index]");
    let dropIndex = totalCount();

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as HTMLElement;
      const itemRect = item.getBoundingClientRect();
      const itemTop = itemRect.top - rect.top + el.scrollTop;

      if (y < itemTop + itemRect.height / 2) {
        dropIndex = parseInt(
          item.getAttribute("data-shortcut-index") || "0",
          10,
        );
        break;
      }
    }

    return Math.min(Math.max(dropIndex, 0), totalCount());
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
    dragItemUri = null;
  };

  const finishDrag = async (commit: boolean) => {
    const source = dragSourceIndex.value;
    const drop = dragDropIndex.value;
    const itemUri = dragItemUri;
    cleanupDrag();

    if (!commit || source == null || drop == null || itemUri == null) return;

    // Don't reorder if dropping at the same position
    if (source === drop || source === drop - 1) return;

    // Find target URI
    const targetIndex = drop > source ? drop - 1 : drop;
    const targetItem = itemAt(targetIndex);
    if (!targetItem) return;

    await reorderShortcutStandalone(itemUri, getShortcutUri(targetItem));
  };

  // Begin dragging a shortcut item.
  const startItemDrag = (evt: PointerEvent, index: number) => {
    // Primary mouse button / touch / pen only.
    if (evt.pointerType === "mouse" && evt.button !== 0) return;

    const item = itemAt(index);
    if (!item) return;

    // Measure the grabbed item
    const el = scrollEl.value;
    const itemEl = (evt.target as HTMLElement | null)?.closest(
      "[data-shortcut-index]",
    ) as HTMLElement | null;

    if (el && itemEl) {
      const cRect = el.getBoundingClientRect();
      const iRect = itemEl.getBoundingClientRect();
      const iTop = iRect.top - cRect.top + el.scrollTop;
      dragRowHeight.value = iRect.height;
      dragGrabOffset = evt.clientY - cRect.top + el.scrollTop - iTop;
      ghostY.value = iTop;
    } else {
      dragRowHeight.value = 48; // fallback height
      dragGrabOffset = dragRowHeight.value / 2;
      ghostY.value = 0;
    }

    dragSourceIndex.value = index;
    dragDropIndex.value = index;
    draggedItem.value = item;
    dragItemUri = getShortcutUri(item);
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

  // Whether a reorder drag is in progress.
  const isDragging = computed(() => dragSourceIndex.value !== null);

  // Extra Y offset for a visible row so rows between source and target slide aside.
  const rowOffset = (index: number): number => {
    const source = dragSourceIndex.value;
    const drop = dragDropIndex.value;
    if (source == null || drop == null || index === source) return 0;

    const height = dragRowHeight.value;

    // Dragging down: rows below source and above target shift up.
    if (drop > source && index > source && index < drop) return -height;

    // Dragging up: rows from target down to source shift down.
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
