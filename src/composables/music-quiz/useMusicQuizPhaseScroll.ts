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
 * Scrolls the round section into view once when a round starts answering and
 * once when it reveals, so the sticky countdown (and later the result with
 * the Ready button) lands at the top of the scroll container.
 */
export function useMusicQuizPhaseScroll(options: MusicQuizPhaseScrollOptions) {
  let lastScrolledKey: string | null = null;

  watch(
    [options.phase, options.roundIndex, options.target],
    ([phase, roundIndex, target]) => {
      if (!phase || !SCROLL_PHASES.has(phase) || roundIndex === null) return;
      const key = `${roundIndex}:${phase}`;
      if (key === lastScrolledKey) return;
      if (!target || typeof target.scrollIntoView !== "function") return;
      lastScrolledKey = key;
      const reducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
        false;
      target.scrollIntoView({
        block: "start",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    { immediate: true, flush: "post" },
  );
}
