import { useSidebar } from "@/components/ui/sidebar/utils";
import {
  useMobileSidebarSide,
  type MobileSidebarSide,
} from "@/composables/useMobileSidebarSide";
import { store } from "@/plugins/store";
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const EDGE_ZONE_PX = 32;
const SWIPE_THRESHOLD_PX = 60;
const VERTICAL_TOLERANCE_PX = 40;

/**
 * Touch handlers for the mobile edge-swipe gesture.
 *
 * Swiping from the configured menu side (see `useMobileSidebarSide`) opens
 * the navigation sheet on the `discover` route, and navigates back on any
 * other route. When the menu opens from the right, that edge always opens
 * the sheet instead, and the left edge navigates back on every route.
 * Navigating back does nothing when there is no previous in-app route.
 *
 * Only active while the mobile sidebar is closed. Bind the returned
 * handlers as passive touchstart/touchmove/touchend listeners.
 */
export function useEdgeSwipeNavigation() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const mobileSidebarSide = useMobileSidebarSide();
  const route = useRoute();
  const router = useRouter();

  const touchStartX = ref(0);
  const touchStartY = ref(0);
  const swipeEdge = ref<MobileSidebarSide | null>(null);

  function onTouchStart(event: TouchEvent) {
    if (!isMobile.value || openMobile.value) return;
    const touch = event.touches[0];
    if (!touch) return;

    touchStartX.value = touch.clientX;
    touchStartY.value = touch.clientY;
    swipeEdge.value = edgeAt(touch.clientX, mobileSidebarSide.value);
  }

  function onTouchMove(event: TouchEvent) {
    const edge = swipeEdge.value;
    if (!edge || !isMobile.value || openMobile.value) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartX.value;
    const deltaY = touch.clientY - touchStartY.value;

    if (Math.abs(deltaY) > VERTICAL_TOLERANCE_PX) {
      swipeEdge.value = null;
      return;
    }

    const traveled = edge === "left" ? deltaX : -deltaX;
    if (traveled > SWIPE_THRESHOLD_PX) {
      triggerSwipeAction(edge);
      swipeEdge.value = null;
    }
  }

  function onTouchEnd() {
    swipeEdge.value = null;
  }

  function triggerSwipeAction(edge: MobileSidebarSide) {
    const side = mobileSidebarSide.value;
    const opensMenu =
      edge === side && (side === "right" || route.name === "discover");

    if (opensMenu) {
      setOpenMobile(true);
    } else if (store.prevRoute) {
      router.back();
    }
  }

  return { onTouchStart, onTouchMove, onTouchEnd };
}

/**
 * The screen edge a touch started at, or null when that edge carries no
 * swipe gesture for the current menu side.
 */
function edgeAt(x: number, side: MobileSidebarSide): MobileSidebarSide | null {
  if (x <= EDGE_ZONE_PX) return "left";
  if (side !== "right") return null;

  const width =
    window.innerWidth ||
    (typeof document !== "undefined"
      ? document.documentElement.clientWidth
      : 0);
  return width > 0 && x >= width - EDGE_ZONE_PX ? "right" : null;
}
