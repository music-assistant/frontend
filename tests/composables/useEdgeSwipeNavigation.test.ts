import { useEdgeSwipeNavigation } from "@/composables/useEdgeSwipeNavigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const {
  afterEachHooks,
  historyState,
  mobileSidebarSide,
  mockRouterBack,
  mockSetOpenMobile,
  routeState,
  sidebarState,
} = vi.hoisted(() => ({
  afterEachHooks: [] as ((to: unknown, from: unknown) => void)[],
  historyState: { back: null as string | null },
  mobileSidebarSide: { value: "left" as "left" | "right" },
  mockRouterBack: vi.fn(),
  mockSetOpenMobile: vi.fn(),
  routeState: { name: "discover" as string, fullPath: "/current" },
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
    afterEach: (hook: (to: unknown, from: unknown) => void) => {
      afterEachHooks.push(hook);
      return () => {
        const at = afterEachHooks.indexOf(hook);
        if (at !== -1) afterEachHooks.splice(at, 1);
      };
    },
    options: { history: { state: historyState } },
  }),
}));

const originalInnerWidth = Object.getOwnPropertyDescriptor(
  window,
  "innerWidth",
);

/** A minimal TouchEvent-shaped object, matching what the handlers read. */
function touchEvent(x: number, y: number, target?: Element): TouchEvent {
  const touch = { clientX: x, clientY: y, identifier: 1 };
  return {
    touches: [touch],
    changedTouches: [touch],
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

// how long the page takes to slide out of (or back into) place
const SETTLE_MS = 220;

/** Lifts the finger and lets the page finish sliding to its resting place. */
function endSwipe(onTouchEnd: () => void) {
  onTouchEnd();
  vi.advanceTimersByTime(SETTLE_MS);
}

/** Tells the composable the back navigation it asked for has finished. */
async function landNavigation() {
  for (const hook of afterEachHooks) {
    hook({ fullPath: "/discover" }, { fullPath: "/album" });
  }
  await nextTick();
}

beforeEach(() => {
  vi.useFakeTimers();
  setViewportWidth(800);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  afterEachHooks.length = 0;
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
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(790, 100));
    onTouchMove(touchEvent(720, 100));
    endSwipe(onTouchEnd);

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  // the history entry is what says whether there is anywhere to go: the app is
  // often opened straight onto a deep-linked page with nothing behind it
  it("does nothing on a back-eligible swipe with nowhere to go back to", () => {
    routeState.name = "album";
    historyState.back = null;
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));
    endSwipe(onTouchEnd);

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  // the shelves reach into the edge zone, and the listeners are passive, so a
  // flick along one would otherwise scroll it and navigate away at once
  it("leaves a sideways drag to a carousel that is scrolled off its start", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const card = cardInsideShelf(true, 240);
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100, card));
    onTouchMove(touchEvent(80, 100, card));
    endSwipe(onTouchEnd);

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

  // history only moves once the finger lifts past the threshold; the page then
  // stays parked off screen so it cannot flash back over the incoming view
  // before the router has rendered it
  it("drags the page with the finger and lets go once the navigation lands", async () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd, swipeStyle } =
      useEdgeSwipeNavigation();

    expect(swipeStyle.value).toBeUndefined();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(55, 100));

    // 45px in: the live page follows the finger, nothing navigated yet
    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(swipeStyle.value).toMatchObject({
      transform: "translate3d(45px, 0, 0)",
      transition: "none",
    });

    onTouchMove(touchEvent(150, 100)); // past the threshold
    endSwipe(onTouchEnd);

    // parked at the far edge of the 800px screen until the router lands
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(swipeStyle.value).toMatchObject({
      transform: "translate3d(800px, 0, 0)",
      transition: "none",
    });

    await landNavigation();

    expect(swipeStyle.value).toBeUndefined();
  });

  // letting go short of the threshold slides the page back where it was and
  // leaves history untouched
  it("navigates nowhere when the swipe falls short", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd, swipeStyle } =
      useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(50, 100)); // 40px, under the 60px threshold
    endSwipe(onTouchEnd);

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(swipeStyle.value).toBeUndefined();
  });

  // a touchcancel means the system claimed the touch — when that was the OS
  // back gesture the OS navigates by itself, so navigating here too would go
  // back twice
  it("navigates nowhere when the system claims the touch", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchCancel, swipeStyle } =
      useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(200, 100)); // well past the threshold
    onTouchCancel();
    vi.advanceTimersByTime(SETTLE_MS);

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(swipeStyle.value).toBeUndefined();
  });

  // a stray thumb or palm landing mid-drag must not re-litigate a gesture
  // already under way
  it("ignores a second finger landing mid-drag", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100)); // locks in horizontal
    onTouchStart({
      touches: [
        { clientX: 80, clientY: 100, identifier: 1 },
        { clientX: 400, clientY: 300, identifier: 2 },
      ],
      changedTouches: [{ clientX: 400, clientY: 300, identifier: 2 }],
    } as unknown as TouchEvent);
    onTouchMove(touchEvent(150, 100)); // the drag carries on
    endSwipe(onTouchEnd);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("keeps the drag when a second finger lifts first", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(150, 100));
    onTouchEnd({
      touches: [{ clientX: 150, clientY: 100, identifier: 1 }],
      changedTouches: [{ clientX: 400, clientY: 300, identifier: 2 }],
    } as unknown as TouchEvent);

    expect(mockRouterBack).not.toHaveBeenCalled();

    endSwipe(onTouchEnd);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // pages re-render on server pushes, so the element under the finger can be
  // replaced mid-drag; the touch stream then stops bubbling and only the
  // listeners held on the node itself still hear it
  it("finishes the swipe when the touched element leaves the DOM mid-drag", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const card = cardInsideShelf(false);
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100, card));
    onTouchMove(touchEvent(80, 100, card));
    card.remove();

    card.dispatchEvent(new Event("touchend"));
    vi.advanceTimersByTime(SETTLE_MS);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // history must move exactly once per swipe: a new gesture started while the
  // last one is still settling or parked cannot navigate again
  it("navigates once even when a new swipe starts before the landing", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(150, 100));
    endSwipe(onTouchEnd); // committed, parked awaiting the landing

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(150, 100));
    endSwipe(onTouchEnd);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // a back navigation swallowed by a router guard never reaches afterEach;
  // the fallback timer is what un-parks the screen
  it("recovers when the navigation never lands", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd, swipeStyle } =
      useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(150, 100));
    endSwipe(onTouchEnd);
    expect(swipeStyle.value).toBeDefined();

    vi.advanceTimersByTime(1000);

    expect(swipeStyle.value).toBeUndefined();
  });

  // the preview keeps covering the incoming page's first frame and leaves the
  // DOM right after
  it("removes the mounted preview once the navigation lands", async () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd, surfaceRef } =
      useEdgeSwipeNavigation();
    const main = document.createElement("main");
    const surface = document.createElement("div");
    main.appendChild(surface);
    document.body.appendChild(main);
    surfaceRef.value = surface;

    // the page behind was photographed when it was navigated away from
    for (const hook of afterEachHooks) {
      hook({ fullPath: "/album" }, { fullPath: "/discover" });
    }

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(150, 100));
    expect(main.querySelectorAll("[inert]").length).toBe(1);
    endSwipe(onTouchEnd);

    await landNavigation();
    vi.advanceTimersByTime(20); // the removal is deferred one frame

    expect(main.querySelectorAll("[inert]").length).toBe(0);
  });

  // with reduced motion the page must still park before the router moves,
  // just without the slide
  it("parks the page without animation under reduced motion", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd, swipeStyle } =
      useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(150, 100));
    onTouchEnd();

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(swipeStyle.value).toMatchObject({
      transform: "translate3d(800px, 0, 0)",
    });

    await landNavigation();

    expect(swipeStyle.value).toBeUndefined();
  });

  // a swipe called off leaves history untouched, so its preview is still a
  // faithful still of the page behind and serves the swipe tried next
  it("keeps the preview for a retried swipe after a cancel", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd, surfaceRef } =
      useEdgeSwipeNavigation();
    const main = document.createElement("main");
    const surface = document.createElement("div");
    main.appendChild(surface);
    document.body.appendChild(main);
    surfaceRef.value = surface;

    // the page behind was photographed when it was navigated away from
    for (const hook of afterEachHooks) {
      hook({ fullPath: "/album" }, { fullPath: "/discover" });
    }

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(50, 100)); // 40px, under the 60px threshold
    expect(main.querySelectorAll("[inert]").length).toBe(1);

    endSwipe(onTouchEnd);
    expect(main.querySelectorAll("[inert]").length).toBe(0);

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(50, 100));

    expect(main.querySelectorAll("[inert]").length).toBe(1);
  });

  // a thumb naturally arcs upward as it crosses the screen; once the drag has
  // locked horizontal that drift must not call the gesture off
  it("keeps the swipe through vertical drift after the horizontal lock", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100)); // locks in horizontal
    onTouchMove(touchEvent(120, 220)); // arcs far past vertical, still ours
    endSwipe(onTouchEnd);

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
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
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(400, 100));
    onTouchMove(touchEvent(470, 100));
    endSwipe(onTouchEnd);

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

  // a diagonal drag can still be a scroll: whichever axis leads when the
  // direction locks is the one that gets the gesture
  it("leaves a drag that leans vertical to the page", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(35, 135)); // 25 across, 35 down: vertical leads
    onTouchMove(touchEvent(80, 135)); // would otherwise clear the threshold
    endSwipe(onTouchEnd);

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  it("leaves a drag that goes straight down to the page", () => {
    routeState.name = "album";
    historyState.back = "/discover";
    const { onTouchStart, onTouchMove, onTouchEnd } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(20, 160)); // 60px down locks the drag vertical
    onTouchMove(touchEvent(80, 160)); // would otherwise clear the threshold
    endSwipe(onTouchEnd);

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
