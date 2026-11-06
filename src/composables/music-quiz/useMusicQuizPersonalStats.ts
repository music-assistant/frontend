import type { MusicQuizSupportedPersonalizedState } from "@/composables/music-quiz/useMusicQuiz";
import {
  getAnswerSeconds,
  getPersonalStats,
  type MusicQuizPersonalRound,
} from "@/helpers/music_quiz_stats";
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";

const STORAGE_KEY = "music-quiz-personal-stats";

interface StoredRounds {
  /**
   * Who these rounds belong to: this game's player id (a new game gives a
   * new one), or the name when there's no id.
   */
  player: string;
  rounds: MusicQuizPersonalRound[];
}

function readStored(): StoredRounds {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored && Array.isArray(stored.rounds)) return stored;
  } catch {
    // Fall through to an empty record.
  }
  return { player: "", rounds: [] };
}

function writeStored(stored: StoredRounds): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Without storage the stats only last until the page reloads.
  }
}

/**
 * A player's own numbers for the end screen. The server only shares the
 * current round with a player, so each reveal is noted as it happens. A new
 * game starts the list again: back in the lobby, a round number going
 * backwards, or a different player name.
 */
export function useMusicQuizPersonalStats(
  stateSource: MaybeRefOrGetter<MusicQuizSupportedPersonalizedState | null>,
  playerIdSource: MaybeRefOrGetter<string | null | undefined> = null,
) {
  const stored = ref<StoredRounds>(readStored());

  function reset(player: string): void {
    stored.value = { player, rounds: [] };
    writeStored(stored.value);
  }

  watch(
    () => {
      const state = toValue(stateSource);
      return [
        state?.phase,
        state?.current_round?.round_index,
        toValue(playerIdSource),
      ] as const;
    },
    ([phase, roundIndex]) => {
      const state = toValue(stateSource);
      if (!state) return;
      const player = toValue(playerIdSource) || state.you.name;
      const lastRound = Math.max(
        -1,
        ...stored.value.rounds.map((round) => round.round_index),
      );
      if (
        phase === "lobby" ||
        stored.value.player !== player ||
        (roundIndex != null && roundIndex < lastRound)
      ) {
        reset(player);
        if (phase === "lobby") return;
      }
      const round = state.current_round;
      if (phase !== "reveal" || roundIndex == null || !round) return;
      // A round that started before this player joined isn't theirs.
      if (state.you.active_from_round > roundIndex) return;
      const answer = state.you.answer;
      const entry: MusicQuizPersonalRound = {
        round_index: roundIndex,
        correct: answer?.correct === true,
        seconds: answer ? getAnswerSeconds(round, answer.answered_at) : null,
      };
      stored.value = {
        player,
        rounds: [
          ...stored.value.rounds.filter(
            (item) => item.round_index !== roundIndex,
          ),
          entry,
        ],
      };
      writeStored(stored.value);
    },
    { immediate: true },
  );

  const stats = computed(() => {
    const result = getPersonalStats(stored.value.rounds);
    const state = toValue(stateSource);
    // Out of the rounds this player was in, even ones whose reveal this
    // device missed.
    const played = state
      ? state.round_count - state.you.active_from_round
      : result.rounds;
    return { ...result, rounds: Math.max(result.rounds, played) };
  });

  return { stats };
}
