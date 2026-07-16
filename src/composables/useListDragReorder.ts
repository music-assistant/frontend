// Pointer-driven drag-to-reorder for plain (non-virtualized) vertical lists,
// following the same interaction pattern as the fullscreen player queue
// (useQueueDragReorder): the source row stays in place (consumer dims it), a
// floating "ghost" follows the pointer, and the rows between source and drop
// position slide aside via transforms to reveal where the item will land.
//
// Consumer contract:
// - `listEl` must be `position: relative` (it anchors the ghost and the row
//   position math) and each row must carry `data-drag-index="<index>"`.
// - The drag handle should have `touch-action: none` so touch drags don't
//   scroll the page.
import { Ref, computed, onBeforeUnmount, ref } from "vue";

interface ListDragReorderOptions {
  // Container element holding the rows (rows tagged with data-drag-index).
  listEl: Ref<HTMLElement | null>;
  // Number of rows currently rendered.
  count: () => number;
  // Called on drop with the source index and the final resting index.
  onCommit: (fromIndex: number, toIndex: number) => void;
  onDragStart?: () => void;
}

export function useListDragReorder(options: ListDragReorderOptions) {
  const { listEl, count, onCommit, onDragStart } = options;

  // Index of the row being dragged (null when idle) and the index the item
  // would be inserted *before* on drop.
  const dragSourceIndex = ref<number | null>(null);
  const dragDropIndex = ref<number | null>(null);
  // Y of the floating ghost's top, relative to listEl.
  const ghostY = ref(0);
  // Height (px) of the dragged row — the size of the gap the others open up.
  const dragRowHeight = ref(0);
  // Offset between the pointer and the top of the grabbed row, so the ghost
  // keeps the same grip point under the finger instead of jumping.
  let dragGrabOffset = 0;
  // Last pointer Y (viewport px) so the auto-scroll loop can recompute the
  // drop target as the list scrolls under a stationary finger.
  let dragPointerY = 0;
  // Nearest scrollable ancestor, resolved at drag start (null = no scrolling).
  let scrollParent: HTMLElement | null = null;
  // Auto-scroll velocity (px/frame) while the pointer sits near an edge.
  let autoScrollSpeed = 0;
  let autoScrollRaf = 0;
  // Lets cleanup detach every drag listener at once.
  let dragAbort: AbortController | null = null;

  const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
    let node = el?.parentElement ?? null;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  // Y position of a row's top within listEl, ignoring the slide transforms
  // (offsetTop is layout-based, so mid-drag transforms don't feed back into
  // the drop math and cause flicker).
  const rowTopWithinList = (row: HTMLElement): number => {
    const container = listEl.value;
    let y = 0;
    let node: HTMLElement | null = row;
    while (node && node !== container) {
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return y;
  };

  // The pointer must cross a slot boundary by this margin before the drop
  // target flips, so the gap doesn't flap when the pointer rests near one.
  const DROP_HYSTERESIS = 12;

  // Resolve the insertion index (drop *before* this index) for a pointer Y.
  //
  // Rows below the source are evaluated at their *collapsed* positions —
  // where they would sit once the dragged row is lifted out. For tall rows
  // this roughly halves the drag distance per slot: without it the pointer
  // would have to travel past the rest of the source row AND the next row's
  // real midpoint to move a single position down.
  const computeDropIndex = (clientY: number): number => {
    const el = listEl.value;
    const source = dragSourceIndex.value;
    const current = dragDropIndex.value ?? source ?? 0;
    if (!el || source == null) return current;
    const listTop = el.getBoundingClientRect().top;

    const rows = new Map<number, { top: number; height: number }>();
    for (const row of el.querySelectorAll<HTMLElement>("[data-drag-index]")) {
      const index = Number(row.dataset.dragIndex);
      if (Number.isNaN(index)) continue;
      rows.set(index, { top: rowTopWithinList(row), height: row.offsetHeight });
    }
    const sourceRow = rows.get(source);
    if (!sourceRow) return current;
    // Full span the source occupies, inter-row gap included (rows below
    // shift up by this much once it is lifted out).
    const nextRow = rows.get(source + 1);
    const sourceSpan = nextRow ? nextRow.top - sourceRow.top : sourceRow.height;

    const scan = (y: number): number => {
      for (let index = 0; index < count(); index++) {
        const row = rows.get(index);
        if (!row) continue;
        const top = index > source ? row.top - sourceSpan : row.top;
        if (y < listTop + top + row.height / 2) return index;
      }
      return count();
    };

    const candidate = scan(clientY);
    if (candidate === current) return current;
    // Only accept the new target when the boundary was crossed by the
    // hysteresis margin (re-scan with the pointer biased back toward the
    // current target).
    const biased = scan(
      candidate > current
        ? clientY - DROP_HYSTERESIS
        : clientY + DROP_HYSTERESIS,
    );
    return biased === candidate ? candidate : current;
  };

  // Set the auto-scroll velocity from how close the pointer is to an edge.
  const updateAutoScroll = (clientY: number) => {
    if (!scrollParent) {
      autoScrollSpeed = 0;
      return;
    }
    const rect = scrollParent.getBoundingClientRect();
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
    const el = listEl.value;
    if (el) {
      ghostY.value = clientY - el.getBoundingClientRect().top - dragGrabOffset;
    }
    dragDropIndex.value = computeDropIndex(clientY);
  };

  function autoScrollFrame() {
    if (dragSourceIndex.value == null) return;
    if (autoScrollSpeed !== 0 && scrollParent) {
      scrollParent.scrollTop += autoScrollSpeed;
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
    scrollParent = null;
    dragSourceIndex.value = null;
    dragDropIndex.value = null;
    dragRowHeight.value = 0;
    dragGrabOffset = 0;
  };

  const finishDrag = (commit: boolean) => {
    const source = dragSourceIndex.value;
    const drop = dragDropIndex.value;
    cleanupDrag();
    if (!commit || source == null || drop == null) return;
    // Removing the source first shifts everything after it down by one, so the
    // final resting index is one lower when dropping below the original spot.
    const finalIndex = drop > source ? drop - 1 : drop;
    if (finalIndex === source) return;
    onCommit(source, finalIndex);
  };

  // Begin dragging a row from its drag handle.
  const startItemDrag = (evt: PointerEvent, index: number) => {
    // Primary mouse button / touch / pen only.
    if (evt.pointerType === "mouse" && evt.button !== 0) return;
    const el = listEl.value;
    if (!el || index < 0 || index >= count()) return;

    const rowEl = el.querySelector<HTMLElement>(`[data-drag-index="${index}"]`);
    if (!rowEl) return;

    const listTop = el.getBoundingClientRect().top;
    const rowTop = rowTopWithinList(rowEl);
    dragRowHeight.value = rowEl.offsetHeight;
    dragGrabOffset = evt.clientY - listTop - rowTop;
    ghostY.value = rowTop;

    dragSourceIndex.value = index;
    dragDropIndex.value = index;
    dragPointerY = evt.clientY;
    scrollParent = findScrollParent(el);
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

  // Index of the row currently being dragged (the dimmed source row).
  const draggingIndex = computed(() => dragSourceIndex.value);

  // Whether a reorder drag is in progress (drives the ghost + gap rendering).
  const isDragging = computed(() => dragSourceIndex.value !== null);

  // Extra Y offset for a row so the rows between the source and the drop
  // target slide aside, opening a gap the size of the dragged row exactly
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
    ghostY,
    dragRowHeight,
    rowOffset,
  };
}
