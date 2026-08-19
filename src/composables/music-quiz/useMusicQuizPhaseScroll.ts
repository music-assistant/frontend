import { watch, type Ref } from "vue";
import type { MusicQuizPhase } from "@/composables/music-quiz/useMusicQuiz";

export interface MusicQuizPhaseScrollOptions {
  phase: () => MusicQuizPhase | null;
  roundIndex: () => number | null;
  target: Ref<HTMLElement | null>;
}

const SCROLL_PHASES: ReadonlySet<MusicQuizPhase> = new Set([
  "answering",
  "reveal",
]);

/**
 * Scrolls the target into view once when a round starts answering, and
 * scrolls the whole container to the top once when the round reveals.
 */
export function useMusicQuizPhaseScroll(options: MusicQuizPhaseScrollOptions) {
  let lastScrolledKey: string | null = null;

  watch(
    [options.phase, options.roundIndex, options.target],
    ([phase, roundIndex, target]) => {
      if (!phase || !SCROLL_PHASES.has(phase) || roundIndex === null) return;
      const key = `${roundIndex}:${phase}`;
      if (key === lastScrolledKey) return;
      if (!target) return;
      const behavior = scrollBehavior();
      if (phase === "reveal") {
        const scrollParent = findScrollParent(target);
        if (!scrollParent || typeof scrollParent.scrollTo !== "function") {
          return;
        }
        lastScrolledKey = key;
        scrollParent.scrollTo({ top: 0, behavior });
        return;
      }
      if (typeof target.scrollIntoView !== "function") return;
      lastScrolledKey = key;
      target.scrollIntoView({ block: "start", behavior });
    },
    { immediate: true, flush: "post" },
  );
}

function scrollBehavior(): ScrollBehavior {
  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return reducedMotion ? "auto" : "smooth";
}

/** Finds the target's scrollable ancestor, falling back to the document. */
function findScrollParent(target: HTMLElement) {
  let el: HTMLElement | null = target.parentElement;
  while (el) {
    if (["auto", "scroll"].includes(getComputedStyle(el).overflowY)) {
      return el;
    }
    el = el.parentElement;
  }
  return document.scrollingElement;
}
