import { useEdgeSwipeNavigation } from "@/composables/useEdgeSwipeNavigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mobileSidebarSide,
  mockRouterBack,
  mockSetOpenMobile,
  routeState,
  sidebarState,
  storeMock,
} = vi.hoisted(() => ({
  mobileSidebarSide: { value: "left" as "left" | "right" },
  mockRouterBack: vi.fn(),
  mockSetOpenMobile: vi.fn(),
  routeState: { name: "discover" as string },
  sidebarState: { isMobile: { value: true }, openMobile: { value: false } },
  storeMock: { prevRoute: undefined as string | undefined },
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

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeState,
  useRouter: () => ({ back: mockRouterBack }),
}));

const originalInnerWidth = Object.getOwnPropertyDescriptor(
  window,
  "innerWidth",
);

/** A minimal TouchEvent-shaped object, matching what the handlers read. */
function touchEvent(x: number, y: number): TouchEvent {
  return { touches: [{ clientX: x, clientY: y }] } as unknown as TouchEvent;
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
  storeMock.prevRoute = undefined;
  if (originalInnerWidth) {
    Object.defineProperty(window, "innerWidth", originalInnerWidth);
  }
});

describe("useEdgeSwipeNavigation", () => {
  it("opens the menu on a left-edge swipe on discover, with the menu on the left", () => {
    storeMock.prevRoute = "/settings";
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockSetOpenMobile).toHaveBeenCalledWith(true);
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it("goes back on a left-edge swipe off discover, with the menu on the left", () => {
    routeState.name = "album";
    storeMock.prevRoute = "/discover";
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  it("opens the menu on a right-edge swipe on any route, with the menu on the right", () => {
    mobileSidebarSide.value = "right";
    routeState.name = "album";
    storeMock.prevRoute = "/discover";
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(790, 100));
    onTouchMove(touchEvent(720, 100));

    expect(mockSetOpenMobile).toHaveBeenCalledWith(true);
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it("goes back on a left-edge swipe, with the menu on the right", () => {
    mobileSidebarSide.value = "right";
    storeMock.prevRoute = "/discover";
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });

  it("does nothing on a back-eligible swipe without a previous route", () => {
    routeState.name = "album";
    storeMock.prevRoute = undefined;
    const { onTouchStart, onTouchMove } = useEdgeSwipeNavigation();

    onTouchStart(touchEvent(10, 100));
    onTouchMove(touchEvent(80, 100));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockSetOpenMobile).not.toHaveBeenCalled();
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
