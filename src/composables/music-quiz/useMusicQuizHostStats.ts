import type { MusicQuizSupportedHostState } from "@/composables/music-quiz/useMusicQuiz";
import {
  getGameAwards,
  getRoundFastest,
  matchCorrectAnswerNames,
  type MusicQuizAward,
  type MusicQuizFastestAnswer,
  type MusicQuizStatsRound,
} from "@/helpers/music_quiz_stats";
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

const STORAGE_PREFIX = "music-quiz-stats-names:";

// localStorage, not sessionStorage: every host tab on this device shares the
// links, so a tab opened mid-game still has the earlier rounds' names.
function readNames(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

function writeNames(key: string, names: Record<string, string>): void {
  try {
    // Only the current game's links are kept.
    for (const stored of Object.keys(localStorage)) {
      if (stored.startsWith(STORAGE_PREFIX) && stored !== key) {
        localStorage.removeItem(stored);
      }
    }
    localStorage.setItem(key, JSON.stringify(names));
  } catch {
    // Without storage the names only last until the page reloads.
  }
}

function statsRounds(
  state: MusicQuizSupportedHostState,
): MusicQuizStatsRound[] {
  // Timeline rounds carry no `answers`, so they simply add nothing.
  return state.rounds as unknown as MusicQuizStatsRound[];
}

/**
 * Round and game stats for the host. Each reveal links that round's correct
 * answers to player names, which the end-of-game awards then build on; the
 * links are kept per game on this device so reloads and other tabs keep them.
 */
export function useMusicQuizHostStats(
  stateSource: MaybeRefOrGetter<MusicQuizSupportedHostState | null>,
) {
  const nameById = ref<Record<string, string>>({});
  let storageKey: string | null = null;

  const currentStatsRound = computed(() => {
    const state = toValue(stateSource);
    const index = state?.current_round?.round_index;
    if (!state || index == null) return null;
    return statsRounds(state).find((round) => round.round_index === index);
  });

  watch(
    () => {
      const state = toValue(stateSource);
      return [
        state?.created_at,
        state?.phase,
        state?.current_round?.round_index,
        state?.players,
      ] as const;
    },
    ([createdAt, phase]) => {
      const state = toValue(stateSource);
      if (!state || createdAt == null) return;
      const key = `${STORAGE_PREFIX}${createdAt}`;
      if (key !== storageKey) {
        storageKey = key;
        nameById.value = readNames(key);
      }
      if (phase !== "reveal" && phase !== "finished") return;
      const round = currentStatsRound.value;
      if (!round) return;
      const matched = matchCorrectAnswerNames(round, state.players);
      if (Object.keys(matched).length === 0) return;
      nameById.value = { ...nameById.value, ...matched };
      writeNames(key, nameById.value);
    },
    { immediate: true },
  );

  const roundFastest = computed<MusicQuizFastestAnswer | null>(() => {
    const round = currentStatsRound.value;
    if (toValue(stateSource)?.phase !== "reveal" || !round) return null;
    return getRoundFastest(round, nameById.value);
  });

  const awards = computed<MusicQuizAward[]>(() => {
    const state = toValue(stateSource);
    if (state?.phase !== "finished") return [];
    return getGameAwards(
      statsRounds(state),
      nameById.value,
      state.answer_duration,
    );
  });

  return { roundFastest, awards };
}
