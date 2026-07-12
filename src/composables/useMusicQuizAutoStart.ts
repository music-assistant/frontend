import type { MusicQuizInfo } from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

export type MusicQuizAutoStartState = Pick<
  MusicQuizInfo,
  "phase" | "auto_start_at"
>;

export function useMusicQuizAutoStart(
  state: MaybeRefOrGetter<MusicQuizAutoStartState | null | undefined>,
) {
  const deadline = computed(() => {
    const currentState = toValue(state);
    return currentState?.phase === "lobby"
      ? (currentState.auto_start_at ?? null)
      : null;
  });
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
