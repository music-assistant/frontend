import { useEdgeSwipeNavigation } from "@/composables/useEdgeSwipeNavigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  historyState,
  mobileSidebarSide,
  mockRouterBack,
  mockSetOpenMobile,
  routeState,
  sidebarState,
} = vi.hoisted(() => ({
  historyState: { back: null as string | null },
  mobileSidebarSide: { value: "left" as "left" | "right" },
  mockRouterBack: vi.fn(),
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

/** A card inside a shelf that does or does not scroll sideways, under `<main>`. */
function cardInsideShelf(scrolls: boolean) {
  const main = document.createElement("main");
  const shelf = document.createElement("div");
  shelf.style.overflowX = scrolls ? "auto" : "visible";
  Object.defineProperty(shelf, "scrollWidth", { value: scrolls ? 900 : 375 });
  Object.defineProperty(shelf, "clientWidth", { value: 375 });
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

beforeEach(() => {
  setViewportWidth(800);
});

afterEach(() => {
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
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

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
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

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
  it("leaves a sideways drag on a carousel to the carousel", () => {
    routeState.name = "search";
    historyState.back = "/discover";
    const card = cardInsideShelf(true);
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100, card));
    onTouchMove(touchEvent(80, 100, card));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  // the same gesture over the same markup, minus the sideways scroll, so the
  // case above cannot pass on the plumbing alone
  it("still goes back over a shelf that has nothing to scroll", () => {
    routeState.name = "search";
    historyState.back = "/discover";
    const card = cardInsideShelf(false);
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100, card));
    onTouchMove(touchEvent(80, 100, card));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the swipe starts away from any edge", () => {
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(400, 100));
    onTouchMove(touchEvent(470, 100));

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
