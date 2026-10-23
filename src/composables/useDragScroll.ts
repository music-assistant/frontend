import { ref, type Ref } from "vue";

// A gesture only counts as a drag once it travels this far, so a click on a
// tile still reaches the tile.
const DRAG_THRESHOLD = 6;

export interface DragScroll {
  dragging: Ref<boolean>;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
  onClickCapture: (e: MouseEvent) => void;
}

/**
 * Click-and-drag panning for a horizontally scrolling element.
 *
 * Bind the returned handlers to the scroller (`onClickCapture` on its click
 * capture phase) and style it off `dragging` while a drag is in progress.
 * Only a mouse is handled: touch and pen already pan natively.
 */
export function useDragScroll(el: Ref<HTMLElement | null>): DragScroll {
  const dragging = ref(false);
  let pointerDown = false;
  let startX = 0;
  let startScroll = 0;
  let swallowClick = false;

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    pointerDown = true;
    swallowClick = false;
    // a scroller that unmounted mid-gesture never got its pointerup
    dragging.value = false;
    startX = e.clientX;
    startScroll = el.value?.scrollLeft ?? 0;
  };

  const onPointerMove = (e: PointerEvent) => {
    const node = el.value;
    if (!pointerDown || !node) return;
    // the button can be let go outside the scroller, where our pointerup never
    // lands; a move with no button held means that gesture is over
    if (!(e.buttons & 1)) {
      pointerDown = false;
      dragging.value = false;
      return;
    }
    const dx = e.clientX - startX;
    if (!dragging.value) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      dragging.value = true;
      node.setPointerCapture(e.pointerId);
      // the browser began a text selection before the gesture was recognised
      // as a drag; leaving it painted across the tiles looks broken
      window.getSelection()?.removeAllRanges();
    }
    node.scrollLeft = startScroll - dx;
  };

  const onPointerUp = () => {
    const node = el.value;
    pointerDown = false;
    // a row with nothing to scroll never moves under the pointer, so the
    // gesture stays the click it looks like
    swallowClick =
      dragging.value && !!node && node.scrollWidth > node.clientWidth;
    dragging.value = false;
  };

  const onClickCapture = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return {
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onClickCapture,
  };
}
