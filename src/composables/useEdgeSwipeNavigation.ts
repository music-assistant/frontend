import { useSidebar } from "@/components/ui/sidebar/utils";
import {
  useMobileSidebarSide,
  type MobileSidebarSide,
} from "@/composables/useMobileSidebarSide";
import { canGoBack } from "@/helpers/navigation";
import {
  capturePageSnapshot,
  type PageSnapshot,
} from "@/helpers/page_snapshot";
import { computed, onScopeDispose, ref, type StyleValue } from "vue";
import { useRoute, useRouter } from "vue-router";

const EDGE_ZONE_PX = 32;
const SWIPE_THRESHOLD_PX = 60;
const VERTICAL_TOLERANCE_PX = 40;
const DIRECTION_LOCK_PX = 12;
const SCROLL_END_SLACK_PX = 1;
const SETTLE_MS = 220;
const SETTLE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const RESTORE_MS = 120;
const REVEAL_PARALLAX = 0.25;

type SwipeAction = "menu" | "back";

/**
 * Touch handlers for the mobile edge-swipe gesture.
 *
 * Swiping from the configured menu side (see `useMobileSidebarSide`) opens
 * the navigation sheet on the `discover` route, and navigates back on any
 * other route. When the menu opens from the right, that edge always opens
 * the sheet instead, and the left edge navigates back on every route.
 * Nothing happens when there is nowhere to go back to.
 *
 * A back swipe is interactive. The moment it commits, the router goes back
 * and the view being left is frozen into a snapshot laid over the top, so the
 * view behind it is on screen and trailing the finger for the whole drag
 * rather than appearing once the gesture is over. Releasing past the
 * threshold sees it out; releasing short of it slides the snapshot back and
 * undoes the navigation. Opening the sheet stays a plain threshold, as the
 * sheet brings its own animation.
 *
 * A carousel under the touch keeps the gesture only while it can still
 * scroll that way; parked at its start it cannot move, so the swipe belongs
 * to the navigation. The drag also has to commit to the horizontal axis.
 *
 * Only active while the mobile sidebar is closed. Bind the returned handlers
 * as passive touchstart/touchmove/touchend/touchcancel listeners, and
 * `surfaceRef` plus `swipeStyle` on the element holding the page.
 */
export function useEdgeSwipeNavigation() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const mobileSidebarSide = useMobileSidebarSide();
  const route = useRoute();
  const router = useRouter();

  const touchStartX = ref(0);
  const touchStartY = ref(0);
  const swipeEdge = ref<MobileSidebarSide | null>(null);
  const swipeAction = ref<SwipeAction | null>(null);
  const surfaceRef = ref<HTMLElement | null>(null);
  const pageOffset = ref(0);
  const settling = ref(false);
  const revealing = ref(false);

  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let snapshot: PageSnapshot | null = null;
  let restoreScroll: (() => void) | null = null;
  let gestureTarget: EventTarget | null = null;

  const swipeStyle = computed<StyleValue | undefined>(() => {
    if (!pageOffset.value && !settling.value) return undefined;

    const x = revealing.value
      ? -(viewportWidth() - pageOffset.value) * REVEAL_PARALLAX
      : pageOffset.value;

    return {
      transform: `translate3d(${x}px, 0, 0)`,
      transition: settling.value
        ? `transform ${SETTLE_MS}ms ${SETTLE_EASING}`
        : "none",
    };
  });

  function onTouchStart(event: TouchEvent) {
    if (!isMobile.value || openMobile.value) return;
    const touch = event.touches[0];
    if (!touch) return;

    touchStartX.value = touch.clientX;
    touchStartY.value = touch.clientY;
    const edge = edgeAt(touch.clientX, mobileSidebarSide.value);
    // a carousel reaches close enough to the edge to be dragged from inside
    // this zone, and the listeners are passive, so the two would both run
    const ours = edge && !scrollerOwnsSwipe(horizontalScrollerAt(event), edge);
    swipeEdge.value = ours ? edge : null;
    swipeAction.value = ours && edge ? actionFor(edge) : null;
    if (swipeAction.value === "back") holdGesture(event.target);
  }

  function holdGesture(target: EventTarget | null) {
    releaseGesture();
    if (!target) return;
    gestureTarget = target;
    target.addEventListener("touchmove", onGestureMove, { passive: true });
    target.addEventListener("touchend", onTouchEnd, { passive: true });
    target.addEventListener("touchcancel", onTouchEnd, { passive: true });
  }

  const onGestureMove = (event: Event) => onTouchMove(event as TouchEvent);

  function releaseGesture() {
    if (!gestureTarget) return;
    gestureTarget.removeEventListener("touchmove", onGestureMove);
    gestureTarget.removeEventListener("touchend", onTouchEnd);
    gestureTarget.removeEventListener("touchcancel", onTouchEnd);
    gestureTarget = null;
  }

  function onTouchMove(event: TouchEvent) {
    const edge = swipeEdge.value;
    const action = swipeAction.value;
    if (!edge || !action || !isMobile.value || openMobile.value) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX.value;
    const deltaY = touch.clientY - touchStartY.value;

    if (
      Math.abs(deltaX) < DIRECTION_LOCK_PX &&
      Math.abs(deltaY) < DIRECTION_LOCK_PX
    ) {
      return;
    }

    if (
      Math.abs(deltaY) > VERTICAL_TOLERANCE_PX ||
      Math.abs(deltaY) >= Math.abs(deltaX)
    ) {
      abandonSwipe();
      return;
    }

    const traveled = edge === "left" ? deltaX : -deltaX;

    if (action === "menu") {
      if (traveled > SWIPE_THRESHOLD_PX) {
        setOpenMobile(true);
        swipeEdge.value = null;
        swipeAction.value = null;
      }
      return;
    }

    if (!revealing.value) beginReveal();
    setOffset(Math.max(0, Math.min(traveled, viewportWidth())));
  }

  function onTouchEnd() {
    const action = swipeAction.value;
    swipeEdge.value = null;
    swipeAction.value = null;
    releaseGesture();
    if (action !== "back" || !revealing.value) return;

    if (pageOffset.value > SWIPE_THRESHOLD_PX) finishReveal();
    else cancelReveal();
  }

  function abandonSwipe() {
    swipeEdge.value = null;
    swipeAction.value = null;
    releaseGesture();
    if (revealing.value) cancelReveal();
  }

  function beginReveal() {
    const surface = surfaceRef.value;
    if (surface) {
      restoreScroll = captureScroll(surface);
      snapshot = capturePageSnapshot(surface);
      snapshot.place(pageOffset.value);
    }
    revealing.value = true;
    router.back();
  }

  function finishReveal() {
    slide(viewportWidth(), () => {
      revealing.value = false;
      setOffset(0);
      dropSnapshot();
    });
  }

  function cancelReveal() {
    slide(0, () => {
      revealing.value = false;
      setOffset(0);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        restoreScroll?.();
        dropSnapshot();
      }, RESTORE_MS);
      router.forward();
    });
  }

  function setOffset(offset: number) {
    pageOffset.value = offset;
    snapshot?.place(offset, settling.value ? SETTLE_MS : undefined);
  }

  function slide(offset: number, onArrival: () => void) {
    clearTimeout(settleTimer);
    if (prefersReducedMotion()) {
      settling.value = false;
      onArrival();
      return;
    }
    settling.value = true;
    setOffset(offset);
    settleTimer = setTimeout(() => {
      settling.value = false;
      onArrival();
    }, SETTLE_MS);
  }

  function dropSnapshot() {
    snapshot?.remove();
    snapshot = null;
    restoreScroll = null;
  }

  function actionFor(edge: MobileSidebarSide): SwipeAction | null {
    const side = mobileSidebarSide.value;
    if (edge === side && (side === "right" || route.name === "discover")) {
      return "menu";
    }
    return canGoBack(router) ? "back" : null;
  }

  onScopeDispose(() => {
    clearTimeout(settleTimer);
    releaseGesture();
    dropSnapshot();
  });

  return { onTouchStart, onTouchMove, onTouchEnd, surfaceRef, swipeStyle };
}

/**
 * The screen edge a touch started at, or null when that edge carries no
 * swipe gesture for the current menu side.
 */
function edgeAt(x: number, side: MobileSidebarSide): MobileSidebarSide | null {
  if (x <= EDGE_ZONE_PX) return "left";
  if (side !== "right") return null;

  const width = viewportWidth();
  return width > 0 && x >= width - EDGE_ZONE_PX ? "right" : null;
}

/**
 * The nearest thing that scrolls sideways under a touch, looking no further
 * out than the element the handlers are bound to.
 */
function horizontalScrollerAt(event: TouchEvent): Element | null {
  let element = event.target instanceof Element ? event.target : null;

  while (element && element !== event.currentTarget) {
    const { overflowX } = getComputedStyle(element);
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      element.scrollWidth > element.clientWidth
    ) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

function scrollerOwnsSwipe(
  scroller: Element | null,
  edge: MobileSidebarSide,
): boolean {
  if (!scroller) return false;
  if (edge === "left") return scroller.scrollLeft > SCROLL_END_SLACK_PX;
  const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
  return scroller.scrollLeft < maxScrollLeft - SCROLL_END_SLACK_PX;
}

function captureScroll(surface: HTMLElement): (() => void) | null {
  const scroller = [...surface.querySelectorAll<HTMLElement>("*")].find(
    (el) => el.scrollTop > 0,
  );
  if (!scroller) return null;
  const top = scroller.scrollTop;
  // leave it alone if the view already restored itself
  return () => {
    if (!scroller.scrollTop) scroller.scrollTop = top;
  };
}

function viewportWidth(): number {
  return (
    window.innerWidth ||
    (typeof document !== "undefined" ? document.documentElement.clientWidth : 0)
  );
}

function prefersReducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}
