import { nextTick, ref, watch } from "vue";

/** Focus each newly available post-placement action. */
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
    if (typeof container.scrollIntoView === "function") {
      const reducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
        false;
      container.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }
    const target =
      container.querySelector<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? container;
    target.focus({ preventScroll: true });
  }
}
