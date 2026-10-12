import { useSidebar } from "@/components/ui/sidebar/utils";
import {
  useMobileSidebarSide,
  type MobileSidebarSide,
} from "@/composables/useMobileSidebarSide";
import { isEmbedded } from "@/helpers/embedded";
import { canGoBack } from "@/helpers/navigation";
import {
  capturePagePreview,
  clearPagePreviews,
  storePagePreview,
  takePagePreview,
  type PagePreview,
} from "@/helpers/page_preview";
import { computed, nextTick, onScopeDispose, ref, type StyleValue } from "vue";
import { useRoute, useRouter } from "vue-router";

const EDGE_ZONE_PX = 32;
const SWIPE_THRESHOLD_PX = 60;
const DIRECTION_LOCK_PX = 12;
const SCROLL_END_SLACK_PX = 1;
const SETTLE_MS = 220;
const SETTLE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const EDGE_SHADOW = "-8px 0 24px rgb(0 0 0 / 0.18)";
const NAVIGATION_TIMEOUT_MS = 1000;
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
 * A back swipe drags the live page along with the finger, revealing a cached
 * still of the view it would return to sliding in behind. History only moves
 * at release: past the threshold the page slides out and the router goes
 * back, exactly once; short of it, or when the system claims the touch, the
 * page slides back into place and nothing is navigated. Opening the sheet
 * stays a plain threshold, as the sheet brings its own animation.
 *
 * A carousel under the touch keeps the gesture only while it can still
 * scroll that way; parked at its start it cannot move, so the swipe belongs
 * to the navigation. The drag also has to commit to the horizontal axis, and
 * once it has, it keeps the gesture for the rest of the touch.
 *
 * Mobile browsers bring their own back gesture over the same edge, so the
 * back half of this gesture only runs when a host page frames the app (see
 * `isEmbedded`) and keeps that gesture to itself; everywhere else the
 * browser's animation is the only one. The menu edge is unaffected. A
 * navigation that lands mid-gesture resets the drag on the spot.
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
  const dragging = ref(false);
  const surfaceRef = ref<HTMLElement | null>(null);
  const pageOffset = ref(0);
  const settling = ref(false);
  const parked = ref(false);

  let trackedTouchId: number | null = null;
  let gestureTarget: EventTarget | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let landingTimer: ReturnType<typeof setTimeout> | undefined;
  let unregisterLanding: (() => void) | null = null;
  let preview: PagePreview | null = null;
  let previewKey: string | null = null;
  // the entry behind the page when the gesture arms is what the abort
  // compares against, so an in-place query sync can be told apart from real
  // movement
  let dragStartBack: unknown = null;

  // the DOM still shows the outgoing page when afterEach runs, which is the
  // last chance to photograph it for the swipe that later returns to it; only
  // a forward navigation leaves that page one step back, so anything else
  // (replace, back, failed) would store a still no swipe can ever reveal, and
  // where the browser owns the back swipe no drag reveals one either
  const unregisterCapture = router.afterEach((to, from, failure) => {
    const surface = surfaceRef.value;
    if (failure || !isMobile.value || !surface || systemOwnsBackSwipe()) return;
    if (router.options.history.state.back !== from.fullPath) return;
    storePagePreview(from.fullPath, capturePagePreview(surface));
  });

  // a navigation can land while a gesture is armed, dragging, or settling —
  // the OS back gesture, a background push, a hardware back button — pulling
  // a new page onto the live surface, so everything stops on the spot: even
  // an action still waiting on its direction lock was decided for the page
  // that just left. A failed navigation moved nothing, and neither does a
  // same-page query sync replacing in place; those leave the gesture alone.
  const unregisterAbort = router.afterEach((to, from, failure) => {
    if (failure || parked.value) return;
    if (!swipeAction.value && !dragging.value && !settling.value) return;
    if (
      to.path === from.path &&
      router.options.history.state.back === dragStartBack
    )
      return;
    clearTimeout(settleTimer);
    settling.value = false;
    clearGesture();
    pageOffset.value = 0;
    shelvePreview();
  });

  const swipeStyle = computed<StyleValue | undefined>(() => {
    // styled for the whole back drag, even at offset zero, so the page always
    // stacks above the preview mounted behind it; menu drags stay untouched
    const backDragging = dragging.value && swipeAction.value === "back";
    if (
      !pageOffset.value &&
      !settling.value &&
      !parked.value &&
      !backDragging
    ) {
      return undefined;
    }

    return {
      transform: `translate3d(${pageOffset.value}px, 0, 0)`,
      transition: settling.value
        ? `transform ${SETTLE_MS}ms ${SETTLE_EASING}`
        : "none",
      boxShadow: EDGE_SHADOW,
      // stack the live page above the preview mounted behind it
      position: "relative",
      zIndex: 1,
    };
  });

  function onTouchStart(event: TouchEvent) {
    if (!isMobile.value || openMobile.value) return;
    // a settle or a committed navigation is still in flight; see it out first
    if (settling.value || parked.value) return;
    const touch = event.changedTouches?.[0] ?? event.touches[0];
    if (!touch) return;
    // a second finger landing mid-gesture must not re-litigate it
    if (gestureLive(event)) return;
    // a drag whose finger vanished without an end left the page shifted;
    // put everything back before this touch takes over
    if (dragging.value) recoverStrandedDrag();

    touchStartX.value = touch.clientX;
    touchStartY.value = touch.clientY;
    const edge = edgeAt(touch.clientX, mobileSidebarSide.value);
    // a carousel reaches close enough to the edge to be dragged from inside
    // this zone, and the listeners are passive, so the two would both run
    const ours = edge && !scrollerOwnsSwipe(horizontalScrollerAt(event), edge);
    swipeEdge.value = ours ? edge : null;
    swipeAction.value = ours && edge ? actionFor(edge) : null;
    trackedTouchId = swipeAction.value ? (touch.identifier ?? 0) : null;
    if (swipeAction.value) {
      dragStartBack = router.options.history.state.back;
      holdGesture(event.target);
    }
  }

  function onTouchMove(event: TouchEvent) {
    const edge = swipeEdge.value;
    const action = swipeAction.value;
    if (!edge || !action || !isMobile.value || openMobile.value) return;

    const touch = trackedTouch(event.touches);
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX.value;
    const deltaY = touch.clientY - touchStartY.value;

    if (!dragging.value) {
      if (
        Math.abs(deltaX) < DIRECTION_LOCK_PX &&
        Math.abs(deltaY) < DIRECTION_LOCK_PX
      ) {
        return;
      }
      // the axis is decided once: vertical hands the touch to the page for
      // good, horizontal keeps it for good — the vertical drift of a thumb
      // arcing across the screen must not call off a drag under way
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        clearGesture();
        return;
      }
      dragging.value = true;
      if (action === "back") mountPreview();
    }

    const traveled = edge === "left" ? deltaX : -deltaX;

    if (action === "menu") {
      if (traveled > SWIPE_THRESHOLD_PX) {
        setOpenMobile(true);
        clearGesture();
      }
      return;
    }

    setOffset(Math.max(0, Math.min(traveled, viewportWidth())));
  }

  function onTouchEnd(event?: TouchEvent) {
    if (!endsTrackedTouch(event)) return;
    const action = swipeAction.value;
    const dragged = dragging.value;
    clearGesture();
    if (action !== "back" || !dragged) return;

    if (pageOffset.value > SWIPE_THRESHOLD_PX) commit();
    else cancel();
  }

  // the system claimed the touch — often for its own back gesture, which
  // performs the navigation itself, so committing here too would go back twice
  function onTouchCancel(event?: TouchEvent) {
    if (!endsTrackedTouch(event)) return;
    const action = swipeAction.value;
    const dragged = dragging.value;
    clearGesture();
    if (action === "back" && dragged) cancel();
  }

  function clearGesture() {
    swipeEdge.value = null;
    swipeAction.value = null;
    dragging.value = false;
    trackedTouchId = null;
    releaseGesture();
  }

  // touch events keep targeting the node under the finger at touchstart; when
  // a re-render detaches that node mid-drag they stop bubbling to <main>, so
  // listeners on the node itself are what keep the gesture alive
  function holdGesture(target: EventTarget | null) {
    releaseGesture();
    if (!target) return;
    gestureTarget = target;
    target.addEventListener("touchmove", onGestureMove, { passive: true });
    target.addEventListener("touchend", onGestureEnd, { passive: true });
    target.addEventListener("touchcancel", onGestureCancel, { passive: true });
  }

  const onGestureMove = (event: Event) => onTouchMove(event as TouchEvent);
  const onGestureEnd = (event: Event) => onTouchEnd(event as TouchEvent);
  const onGestureCancel = (event: Event) => onTouchCancel(event as TouchEvent);

  function releaseGesture() {
    if (!gestureTarget) return;
    gestureTarget.removeEventListener("touchmove", onGestureMove);
    gestureTarget.removeEventListener("touchend", onGestureEnd);
    gestureTarget.removeEventListener("touchcancel", onGestureCancel);
    gestureTarget = null;
  }

  function gestureLive(event: TouchEvent): boolean {
    if (!swipeAction.value && !dragging.value) return false;
    return trackedTouch(event.touches) !== undefined;
  }

  function trackedTouch(touches: TouchList): Touch | undefined {
    return [...touches].find((t) => t.identifier === trackedTouchId);
  }

  // an end for some other finger must not end the tracked drag
  function endsTrackedTouch(event?: TouchEvent): boolean {
    if (!event?.changedTouches || trackedTouchId === null) return true;
    return [...event.changedTouches].some(
      (t) => t.identifier === trackedTouchId,
    );
  }

  function recoverStrandedDrag() {
    dragging.value = false;
    pageOffset.value = 0;
    shelvePreview();
  }

  function mountPreview() {
    dropPreview();
    const container = surfaceRef.value?.parentElement;
    const backPath = router.options.history.state.back;
    if (!container || typeof backPath !== "string") return;
    preview = takePagePreview(backPath) ?? null;
    previewKey = preview ? backPath : null;
    preview?.mount(container);
  }

  function commit() {
    slide(viewportWidth(), () => {
      parked.value = true;
      router.back();
      awaitLanding();
    });
  }

  function cancel() {
    slide(0, shelvePreview);
  }

  // nothing was navigated, so the still is as good as new for a retried swipe
  function shelvePreview() {
    if (preview && previewKey) {
      preview.remove();
      storePagePreview(previewKey, preview);
    }
    preview = null;
    previewKey = null;
  }

  // the page stays parked off screen until the destination has rendered;
  // snapping back any sooner would flash it over the incoming view
  function awaitLanding() {
    const land = () => {
      if (!parked.value) return;
      unregisterLanding?.();
      unregisterLanding = null;
      clearTimeout(landingTimer);
      parked.value = false;
      pageOffset.value = 0;
      // the preview keeps covering the incoming page's first mount frame
      const covering = preview;
      preview = null;
      previewKey = null;
      requestAnimationFrame(() => covering?.remove());
    };
    unregisterLanding = router.afterEach(() => void nextTick(land));
    // a navigation that errors out never reaches afterEach and must not
    // leave the screen parked on nothing
    landingTimer = setTimeout(land, NAVIGATION_TIMEOUT_MS);
  }

  function setOffset(offset: number) {
    pageOffset.value = offset;
    preview?.place(
      -(viewportWidth() - offset) * REVEAL_PARALLAX,
      settling.value ? SETTLE_MS : undefined,
    );
  }

  function slide(offset: number, onArrival: () => void) {
    clearTimeout(settleTimer);
    if (prefersReducedMotion()) {
      setOffset(offset);
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

  function dropPreview() {
    preview?.remove();
    preview = null;
    previewKey = null;
  }

  function actionFor(edge: MobileSidebarSide): SwipeAction | null {
    const side = mobileSidebarSide.value;
    if (edge === side && (side === "right" || route.name === "discover")) {
      return "menu";
    }
    // outside a host the browser owns this edge; claiming the touch too
    // would paint the previous page twice
    if (systemOwnsBackSwipe()) return null;
    return canGoBack(router) ? "back" : null;
  }

  onScopeDispose(() => {
    clearTimeout(settleTimer);
    clearTimeout(landingTimer);
    unregisterLanding?.();
    unregisterCapture();
    unregisterAbort();
    releaseGesture();
    dropPreview();
    clearPagePreviews();
  });

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    surfaceRef,
    swipeStyle,
  };
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

/** Whether the browser brings its own back-swipe gesture to this page. */
function systemOwnsBackSwipe(): boolean {
  // every mobile browser we run in claims the same edge: iOS animates a system
  // snapshot of the previous page, Android chains the system back gesture. A
  // second drag run next to one of those paints the previous page twice, so
  // the gesture is only ours inside a host that keeps navigation to itself.
  return !isEmbedded();
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
