import { ref, watch, type Ref } from "vue";

export interface MusicQuizRoundStartScrollOptions {
  active: () => boolean;
  roundIndex: () => number | null;
  target: Ref<HTMLElement | null>;
}

/**
 * Scrolls the answering section into view once at the start of each round,
 * so the sticky countdown lands at the top of the scroll container and the
 * answer controls stay visible without the player having to scroll.
 */
export function useMusicQuizRoundStartScroll(
  options: MusicQuizRoundStartScrollOptions,
) {
  const lastScrolledRound = ref<number | null>(null);

  watch(
    [options.active, options.roundIndex],
    ([active, roundIndex]) => {
      if (!active || roundIndex === null) return;
      if (roundIndex === lastScrolledRound.value) return;
      lastScrolledRound.value = roundIndex;
      scrollToTarget();
    },
    { immediate: true, flush: "post" },
  );

  function scrollToTarget() {
    const element = options.target.value;
    if (!element || typeof element.scrollIntoView !== "function") return;
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    element.scrollIntoView({
      block: "start",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }
}
