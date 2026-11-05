import { useEventListener } from "@vueuse/core";
import { onScopeDispose, watch, type Ref, type WatchSource } from "vue";

const REFOCUS_DELAY_MS = 5000;
const USER_SCROLL_EVENTS = ["wheel", "touchmove", "pointerdown", "keydown"];

/**
 * Keeps the `aria-current` row of a scroll box in view, with a few rows above
 * it, and returns to it once the user stops scrolling the box.
 */
export function useFollowActiveRow(
  box: Ref<HTMLElement | null | undefined>,
  trigger: WatchSource,
  rowsAbove: number,
) {
  let browsing = false;
  let refocusTimer: ReturnType<typeof setTimeout> | undefined;

  const scrollToActive = (behavior: ScrollBehavior = "auto") => {
    const container = box.value;
    const row = container?.querySelector("[aria-current='true']");
    if (!container || !row) return;
    let target = row;
    for (let i = 0; i < rowsAbove && target.previousElementSibling; i++) {
      target = target.previousElementSibling;
    }
    const top =
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top, behavior });
  };

  watch(
    [box, trigger],
    () => {
      if (!browsing) scrollToActive();
    },
    { flush: "post", immediate: true },
  );

  useEventListener(box, USER_SCROLL_EVENTS, () => {
    browsing = true;
    clearTimeout(refocusTimer);
    refocusTimer = setTimeout(() => {
      browsing = false;
      scrollToActive("smooth");
    }, REFOCUS_DELAY_MS);
  });

  onScopeDispose(() => clearTimeout(refocusTimer));
}
