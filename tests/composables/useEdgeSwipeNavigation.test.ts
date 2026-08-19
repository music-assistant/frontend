import { useEdgeSwipeNavigation } from "@/composables/useEdgeSwipeNavigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  historyState,
  mobileSidebarSide,
  mockRouterBack,
  mockRouterForward,
  mockSetOpenMobile,
  routeState,
  sidebarState,
} = vi.hoisted(() => ({
  historyState: { back: null as string | null },
  mobileSidebarSide: { value: "left" as "left" | "right" },
  mockRouterBack: vi.fn(),
  mockRouterForward: vi.fn(),
  mockSetOpenMobile: vi.fn(),
  routeState: { name: "discover" as string },
  sidebarState: { isMobile: { value: true }, openMobile: { value: false } },
}));

vi.mock("@/components/ui/sidebar/utils", () => ({
  useSidebar: () => ({
    isMobile: sidebarState.isMobile,
    openMobile: sidebarState.openMobile,
    setOpenMobile: mockSetOpenMobile,
  }),
}));

vi.mock("@/composables/useMobileSidebarSide", () => ({
  useMobileSidebarSide: () => mobileSidebarSide,
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    back: mockRouterBack,
    forward: mockRouterForward,
    options: { history: { state: historyState } },
  }),
}));

const originalInnerWidth = Object.getOwnPropertyDescriptor(
  window,
  "innerWidth",
);

/** A minimal TouchEvent-shaped object, matching what the handlers read. */
function touchEvent(x: number, y: number, target?: Element): TouchEvent {
  return {
    touches: [{ clientX: x, clientY: y }],
    target,
    currentTarget: target?.closest("main"),
  } as unknown as TouchEvent;
}

/**
 * A card inside a shelf that does or does not scroll sideways, under `<main>`.
 * `scrollLeft` says how far the shelf is scrolled off its start, which is what
 * decides whether it still has anywhere to go.
 */
function cardInsideShelf(scrolls: boolean, scrollLeft = 0) {
  const main = document.createElement("main");
  const shelf = document.createElement("div");
  shelf.style.overflowX = scrolls ? "auto" : "visible";
  Object.defineProperty(shelf, "scrollWidth", { value: scrolls ? 900 : 375 });
  Object.defineProperty(shelf, "clientWidth", { value: 375 });
  Object.defineProperty(shelf, "scrollLeft", { value: scrollLeft });
  const card = document.createElement("button");
  shelf.appendChild(card);
  main.appendChild(shelf);
  document.body.appendChild(main);
  return card;
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
}

// how long the page takes to slide out before the view behind it renders
const SETTLE_MS = 220;

/** Lifts the finger and lets the page finish sliding out of the way. */
function endSwipe(onTouchEnd: () => void) {
  onTouchEnd();
  vi.advanceTimersByTime(SETTLE_MS);
}

beforeEach(() => {
  vi.useFakeTimers();
  setViewportWidth(800);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mobileSidebarSide.value = "left";
  routeState.name = "discover";
  sidebarState.isMobile.value = true;
  sidebarState.openMobile.value = false;
  historyState.back = null;
  document.body.innerHTML = "";
  if (originalInnerWidth) {
    Object.defineProperty(window, "innerWidth", originalInnerWidth);
  }
});

describe("useEdgeSwipeNavigation", () => {
  it("opens the menu on a left-edge swipe on discover, with the menu on the left", () => {
    historyState.back = "/settings";
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockSetOpenMobile).toHaveBeenCalledWith(true);
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it("goes back on a left-edge swipe off discover, with the menu on the left", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));
    endSwipe(onTouchEnd);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  it("opens the menu on a right-edge swipe on any route, with the menu on the right", () => {
    mobileSidebarSide.value = "right";
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(790, 100));
    onTouchMove(touchEvent(720, 100));

    expect(mockSetOpenMobile).toHaveBeenCalledWith(true);
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it("goes back on a left-edge swipe, with the menu on the right", () => {
    mobileSidebarSide.value = "right";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));
    endSwipe(onTouchEnd);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  it("does nothing on a right-edge swipe, with the menu on the left", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(790, 100));
    onTouchMove(touchEvent(720, 100));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  // the history entry is what says whether there is anywhere to go: the app is
  // often opened straight onto a deep-linked page with nothing behind it
  it("does nothing on a back-eligible swipe with nowhere to go back to", () => {
    routeState.name = "album";
    historyState.back = null;
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  // the shelves reach into the edge zone, and the listeners are passive, so a
  // flick along one would otherwise scroll it and navigate away at once
  it("leaves a sideways drag to a carousel that is scrolled off its start", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const card = cardInsideShelf(true, 240);
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100, card));
    onTouchMove(touchEvent(80, 100, card));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  // the home screen is wall to wall carousels sitting at their start, and a
  // swipe cannot scroll one further that way: handing it the gesture anyway
  // left dead stripes down the edge where nothing happened at all
  it("takes the swipe over a carousel parked at its start", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const card = cardInsideShelf(true);
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100, card));
    onTouchMove(touchEvent(80, 100, card));
    endSwipe(onTouchEnd);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // mirrored: from the right edge the swipe drags a carousel onwards, so this
  // time it is the far end that has nothing left to give
  it("leaves a right-edge drag to a carousel that can still scroll on", () => {
    mobileSidebarSide.value = "right";
    routeState.name = "album";
    const card = cardInsideShelf(true);
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(790, 100, card));
    onTouchMove(touchEvent(720, 100, card));

    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  // the same gesture over the same markup, minus the sideways scroll, so the
  // cases above cannot pass on the plumbing alone
  it("still goes back over a shelf that has nothing to scroll", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const card = cardInsideShelf(false);
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100, card));
    onTouchMove(touchEvent(80, 100, card));
    endSwipe(onTouchEnd);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // swiping used to drag the page off a blank background and only show where
  // you were going once it was over: the router now moves at the start of the
  // gesture so the view behind is real, on screen, and following the finger
  it("reveals the view behind as soon as the swipe commits", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, swipeStyle } = useEdgeSwipeNavigation();

    expect(swipeStyle.value).toBeUndefined();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(55, 100));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    // 45px into an 800px screen, so the incoming view still has a quarter of
    // the remaining 755px to close before it sits square
    expect(swipeStyle.value).toMatchObject({
      transform: "translate3d(-188.75px, 0, 0)",
      transition: "none",
    });
  });

  it("lets go of the page again once it is back in place", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd, swipeStyle } =
      useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));
    endSwipe(onTouchEnd);

    // the page is put straight back in the task the previous view renders in,
    // so it is never painted off to the side under the incoming page
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(swipeStyle.value).toBeUndefined();
  });

  // the reveal costs a navigation up front, so calling the gesture off has to
  // put that back rather than leaving the user a page further along
  it("undoes the navigation when the swipe falls short", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd, swipeStyle } =
      useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(50, 100)); // 40px, under the 60px threshold
    expect(mockRouterBack).toHaveBeenCalledTimes(1);

    endSwipe(onTouchEnd);

    expect(mockRouterForward).toHaveBeenCalledTimes(1);
    expect(swipeStyle.value).toBeUndefined();
  });

  // a drag that turns into a scroll has committed just the same, so it owes
  // the same undo
  it("undoes the navigation when the drag turns vertical", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));
    expect(mockRouterBack).toHaveBeenCalledTimes(1);

    onTouchMove(touchEvent(90, 200)); // drifted well past the tolerance
    vi.advanceTimersByTime(SETTLE_MS);

    expect(mockRouterForward).toHaveBeenCalledTimes(1);
  });

  // the sheet animates itself in, so that half of the gesture is untouched
  it("leaves the page alone when the swipe opens the menu", () => {
    const { onTouchStart, onTouchMove, swipeStyle } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockSetOpenMobile).toHaveBeenCalledWith(true);
    expect(swipeStyle.value).toBeUndefined();
  });

  it("does nothing when the swipe starts away from any edge", () => {
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(400, 100));
    onTouchMove(touchEvent(470, 100));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  // a drag has no meaningful direction in its first pixels, so reading one out
  // of the jitter would cancel gestures that were about to go horizontal
  it("keeps tracking through the jitter at the start of a drag", () => {
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(13, 108)); // leans vertical, but nothing committed
    onTouchMove(touchEvent(80, 110));

    expect(mockSetOpenMobile).toHaveBeenCalledWith(true);
  });

  // a diagonal drag stays under the vertical tolerance while still being a
  // scroll: whichever axis leads is the one that gets the gesture
  it("leaves a drag that leans vertical to the page", () => {
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(35, 135)); // 25 across, 35 down: vertical leads
    onTouchMove(touchEvent(80, 135)); // would otherwise clear the threshold

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  it("does nothing once vertical drift exceeds the tolerance", () => {
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(20, 160)); // 60px vertical drift cancels tracking
    onTouchMove(touchEvent(80, 160)); // would otherwise clear the threshold

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  it("does nothing while the mobile sidebar is already open", () => {
    sidebarState.openMobile.value = true;
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  it("does nothing outside mobile layout", () => {
    sidebarState.isMobile.value = false;
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });
});
