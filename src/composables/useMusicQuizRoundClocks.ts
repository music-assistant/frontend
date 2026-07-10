import type {
  MusicQuizCurrentRound,
  MusicQuizPublicState,
} from "@/composables/useMusicQuiz";
import { computed, ref, watch, type Ref } from "vue";

/**
 * Client-side clocks for the Music Quiz: the answering countdown (using server's
 * deadline timestamp) and lyrics playback position (using server timestamps).
 * Timestamps are epoch SECONDS as float on the SERVER clock.
 */
export function useMusicQuizRoundClocks(
  state: Ref<MusicQuizPublicState | null>,
  currentRound: Ref<MusicQuizCurrentRound | null>,
) {
  const answerRemainingSeconds = ref<number | null>(null);
  const answerRemainingFraction = ref<number | null>(null);
  const lyricsPosition = ref(0);

  let answerCountdownTimer: ReturnType<typeof setInterval> | undefined;
  let lyricsFrame: number | undefined;

  const answerRemainingLabel = computed(() => {
    if (answerRemainingSeconds.value === null) return "";
    return formatCountdown(answerRemainingSeconds.value);
  });

  function formatCountdown(seconds: number) {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function updateAnswerCountdown() {
    const round = currentRound.value;
    if (state.value?.phase !== "answering" || !round?.deadline) {
      answerRemainingSeconds.value = null;
      answerRemainingFraction.value = null;
      return;
    }
    const nowSeconds = Date.now() / 1000;
    const remaining = round.deadline - nowSeconds;
    // Clamp negative remainders to 0 (tolerate client/server clock skew)
    answerRemainingSeconds.value = Math.max(0, Math.ceil(remaining));
    const duration = state.value.answer_duration;
    answerRemainingFraction.value =
      duration > 0 ? Math.min(1, Math.max(0, remaining / duration)) : 0;
  }

  function startAnswerCountdown() {
    updateAnswerCountdown();
    if (answerCountdownTimer) return;
    answerCountdownTimer = setInterval(updateAnswerCountdown, 250);
  }

  function stopAnswerCountdown() {
    if (answerCountdownTimer) clearInterval(answerCountdownTimer);
    answerCountdownTimer = undefined;
    answerRemainingSeconds.value = null;
    answerRemainingFraction.value = null;
  }

  function updateLyricsPosition() {
    const round = currentRound.value;
    if (state.value?.phase !== "reveal" || !round?.started_at) {
      lyricsPosition.value = 0;
      lyricsFrame = undefined;
      return;
    }
    const nowSeconds = Date.now() / 1000;
    const elapsed = Math.max(0, nowSeconds - round.started_at);
    lyricsPosition.value =
      typeof round.duration === "number" && round.duration > 0
        ? Math.min(elapsed, round.duration)
        : elapsed;
    lyricsFrame = requestAnimationFrame(updateLyricsPosition);
  }

  function startLyricsClock() {
    if (lyricsFrame) return;
    updateLyricsPosition();
  }

  function stopLyricsClock() {
    if (!lyricsFrame) return;
    cancelAnimationFrame(lyricsFrame);
    lyricsFrame = undefined;
  }

  function resetRevealLyrics() {
    stopLyricsClock();
    lyricsPosition.value = 0;
  }

  watch(
    () =>
      [
        state.value?.phase,
        currentRound.value?.deadline,
        currentRound.value?.started_at,
      ] as const,
    ([phase]) => {
      if (phase !== "answering") {
        stopAnswerCountdown();
        return;
      }
      startAnswerCountdown();
    },
    { immediate: true },
  );

  watch(
    () =>
      [
        state.value?.phase,
        currentRound.value?.track_uri,
        currentRound.value?.started_at,
      ] as const,
    ([phase, trackUri]) => {
      if (phase !== "reveal" || !trackUri) {
        resetRevealLyrics();
        return;
      }
      startLyricsClock();
    },
    { immediate: true },
  );

  function teardown() {
    stopAnswerCountdown();
    stopLyricsClock();
  }

  return {
    answerRemainingLabel,
    answerRemainingSeconds,
    answerRemainingFraction,
    lyricsPosition,
    teardown,
  };
}
