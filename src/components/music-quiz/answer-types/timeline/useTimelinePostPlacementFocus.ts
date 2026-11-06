import { nextTick, ref, watch } from "vue";

/**
 * Bring each newly available post-placement action (a bonus question) into
 * view and focus it.
 */
export function useTimelinePostPlacementFocus(
  actionKey: () => string | undefined,
  isBusy: () => boolean,
) {
  const postPlacementRef = ref<HTMLElement | null>(null);
  let focusPending = false;

  watch([actionKey, isBusy], ([nextActionKey, busy], [previousActionKey]) => {
    if (nextActionKey && nextActionKey !== previousActionKey) {
      focusPending = true;
    }
    if (!nextActionKey) focusPending = false;
    if (focusPending && !busy) {
      focusPending = false;
      void focusPostPlacement();
    }
  });

  return { postPlacementRef };

  async function focusPostPlacement() {
    await nextTick();
    const container = postPlacementRef.value;
    if (!container) return;
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const behavior = reducedMotion ? "auto" : "smooth";
    // scrollIntoView also scrolls the page itself, which slides the top bar
    // away on phones; scroll only the area the timeline sits in.
    scrollWithinArea(container, behavior);
    // Focus the bonus area itself: a text field would pop a phone's keyboard
    // up, and the first button could be "Skip", which Enter would press.
    container.focus({ preventScroll: true });
  }
}

function scrollWithinArea(element: HTMLElement, behavior: ScrollBehavior) {
  let area = element.parentElement;
  while (area) {
    const overflow = getComputedStyle(area).overflowY;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      area.scrollHeight > area.clientHeight
    ) {
      break;
    }
    area = area.parentElement;
  }
  if (!area?.scrollTo) return;
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const top =
    element.getBoundingClientRect().top -
    area.getBoundingClientRect().top +
    area.scrollTop -
    margin;
  area.scrollTo({ top: Math.max(0, top), behavior });
}
