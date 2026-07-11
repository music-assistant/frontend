import { nextTick, ref, watch } from "vue";

/** Focus post-placement controls when a placement becomes locked. */
export function useTimelinePostPlacementFocus(
  hasPlacement: () => boolean,
  isBusy: () => boolean,
) {
  const postPlacementRef = ref<HTMLElement | null>(null);
  let focusPending = false;

  watch(
    [hasPlacement, isBusy],
    ([hasLockedPlacement, busy], [hadLockedPlacement]) => {
      if (hasLockedPlacement && !hadLockedPlacement) focusPending = true;
      if (!hasLockedPlacement) focusPending = false;
      if (focusPending && !busy) {
        focusPending = false;
        void focusPostPlacement();
      }
    },
  );

  return { postPlacementRef };

  async function focusPostPlacement() {
    await nextTick();
    const container = postPlacementRef.value;
    if (!container) return;
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    container.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    const target =
      container.querySelector<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? container;
    target.focus({ preventScroll: true });
  }
}
