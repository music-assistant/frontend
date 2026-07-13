import { useMediaQuery } from "@vueuse/core";

const CELEBRATION_COLORS = [
  "#03a9f4",
  "#ffd54f",
  "#4caf50",
  "#ff9800",
  "#ffffff",
];

/**
 * Winner celebration for the Music Quiz finale. `celebrate()` fires a confetti
 * burst, lazy-loading the confetti library on first use and skipping entirely
 * when the user prefers reduced motion.
 */
export function useMusicQuizCelebration() {
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );

  async function celebrate() {
    if (prefersReducedMotion.value) return;
    try {
      const { default: confetti } = await import("canvas-confetti");
      const options = { colors: CELEBRATION_COLORS, zIndex: 100 } as const;
      confetti({
        ...options,
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      confetti({
        ...options,
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        ...options,
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    } catch (error) {
      console.warn("Music Quiz celebration could not load:", error);
    }
  }

  return { celebrate };
}
