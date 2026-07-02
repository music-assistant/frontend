import { ref } from "vue";

/**
 * Returns viewport coordinates for mouse, pointer or touch events,
 * falling back to 0,0 when the event carries none.
 */
export function getEventPosition(evt: Event): { x: number; y: number } {
  if ("touches" in evt) {
    const touchEvt = evt as TouchEvent;
    const touch = touchEvt.touches[0] ?? touchEvt.changedTouches[0];
    return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
  }
  const mouseEvt = evt as MouseEvent;
  return { x: mouseEvt.clientX ?? 0, y: mouseEvt.clientY ?? 0 };
}

/**
 * Open a context menu on touch long-press (via the v-hold directive).
 *
 * Mobile browsers do not reliably fire `contextmenu` for touch input
 * (iOS WebKit never does), so components that only bind `@contextmenu`
 * lose their menu on real touch devices. Pair this with the existing
 * `@contextmenu.prevent` binding, on the root element:
 *
 *   v-hold="onHold"
 *   @touchstart.passive="onTouchStart"
 *   @click.capture="swallowClickAfterHold"
 *
 * `swallowClickAfterHold` suppresses the click that fires on finger-lift
 * after a long-press, so the hold does not also trigger the tap action.
 * Binding it on the capture phase kills the click before it reaches any
 * child button or RouterLink handler, so those need no guards of their own.
 */
export function useHoldToOpenMenu<A extends unknown[]>(
  openMenu: (evt: Event, ...args: A) => void,
) {
  const holdFired = ref(false);

  const onTouchStart = () => {
    holdFired.value = false;
  };

  const onHold = (evt: Event, ...args: A) => {
    holdFired.value = true;
    openMenu(evt, ...args);
  };

  const swallowClickAfterHold = (evt: Event): boolean => {
    if (!holdFired.value) return false;
    holdFired.value = false;
    evt.preventDefault();
    evt.stopPropagation();
    return true;
  };

  return { onHold, onTouchStart, swallowClickAfterHold };
}
