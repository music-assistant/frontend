import { useMusicQuizAnswerDeadline } from "@/composables/music-quiz/useMusicQuizAnswerDeadline";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

export interface MusicQuizRevealCountdownOptions {
  active: MaybeRefOrGetter<boolean>;
  autoAdvanceAt: MaybeRefOrGetter<number | null | undefined>;
}

export function useMusicQuizRevealCountdown(
  options: MusicQuizRevealCountdownOptions,
) {
  const deadline = computed(() =>
    toValue(options.active) ? (toValue(options.autoAdvanceAt) ?? null) : null,
  );
  const isScheduled = computed(() => deadline.value !== null);
  const deadlineState = useMusicQuizAnswerDeadline({
    active: isScheduled,
    deadline,
    duration: null,
  });
  const hasElapsed = computed(() => deadlineState.remainingSeconds.value === 0);

  return {
    ...deadlineState,
    isScheduled,
    hasElapsed,
  };
}
