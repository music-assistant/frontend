import {
  createMusicQuiz,
  deleteMusicQuiz,
  getMusicQuiz,
  type MusicQuizDifficulty,
  nextMusicQuiz,
  resetMusicQuiz,
  revealMusicQuiz,
  startMusicQuiz,
  type MusicQuizCurrentRound,
  type MusicQuizHostState,
} from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  getMusicQuizErrorMessage,
  isNoActiveMusicQuizError,
} from "@/helpers/music_quiz";

export interface UseMusicQuizHostOptions {
  notifyError: (message: string) => void;
}

/**
 * Host-side Music Quiz management: single game per provider instance,
 * PROVIDER_EVENT driven (no polling). Fetches music_quiz/get on mount,
 * subscribes to PROVIDER_EVENT (game_updated -> re-fetch, game_removed -> clear),
 * and wraps all host actions.
 */
export function useMusicQuizHost(options: UseMusicQuizHostOptions) {
  const { notifyError } = options;

  const state = ref<MusicQuizHostState | null>(null);
  const gameRemoved = ref(false);
  const busy = ref(false);
  const loading = ref(false);

  let unsubscribeProviderEvent: (() => void) | undefined;

  const currentRound = computed<MusicQuizCurrentRound | null>(() => {
    return state.value?.current_round ?? null;
  });

  const isLastRound = computed(() => {
    if (!state.value) return false;
    return (
      state.value.current_round &&
      state.value.current_round.round_index >= state.value.round_count - 1
    );
  });

  const joinLink = computed(() => state.value?.join_url ?? "");

  const phaseLabel = computed(() => {
    if (!state.value) return "";
    if (state.value.phase === "lobby")
      return $t("providers.music_quiz.phase_waiting_for_players");
    if (state.value.phase === "answering")
      return $t("providers.music_quiz.phase_answers_open");
    if (state.value.phase === "reveal")
      return $t("providers.music_quiz.phase_enjoy_track");
    return $t("providers.music_quiz.phase_finished");
  });

  async function fetchState() {
    try {
      loading.value = true;
      const nextState = await getMusicQuiz();
      state.value = nextState;
      gameRemoved.value = false;
    } catch (err) {
      if (isNoActiveMusicQuizError(err)) {
        state.value = null;
        gameRemoved.value = false;
      } else {
        notifyError(
          getMusicQuizErrorMessage(
            err,
            $t("providers.music_quiz.error_load_state"),
          ),
        );
      }
    } finally {
      loading.value = false;
    }
  }

  function handleProviderEvent(event: { object_id?: string; data?: unknown }) {
    // object_id is the provider instance_id; we don't filter on it here
    // because there's only one music_quiz provider instance per server
    if (!event.data || typeof event.data !== "object") return;
    const payload = event.data as {
      event?: string;
      state?: MusicQuizHostState;
    };
    if (payload.event === "game_updated") {
      // Re-fetch on game_updated to get the latest host state
      fetchState();
    } else if (payload.event === "game_removed") {
      state.value = null;
      gameRemoved.value = true;
    }
  }

  async function create(
    quiz_type: string,
    round_count: number,
    suggestion_count: number,
    answer_duration: number,
    difficulty: MusicQuizDifficulty,
    source_uris: string[],
    name?: string,
  ) {
    busy.value = true;
    try {
      const nextState = await createMusicQuiz(
        quiz_type,
        round_count,
        suggestion_count,
        answer_duration,
        difficulty,
        source_uris,
        name,
      );
      state.value = nextState;
      gameRemoved.value = false;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_create")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function start() {
    busy.value = true;
    try {
      const nextState = await startMusicQuiz();
      state.value = nextState;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_start")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function reveal() {
    busy.value = true;
    try {
      const nextState = await revealMusicQuiz();
      state.value = nextState;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_reveal")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function next() {
    busy.value = true;
    try {
      const nextState = await nextMusicQuiz();
      state.value = nextState;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_next")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function reset() {
    busy.value = true;
    try {
      const nextState = await resetMusicQuiz();
      state.value = nextState;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_reset")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function deleteGame() {
    busy.value = true;
    try {
      await deleteMusicQuiz();
      state.value = null;
      gameRemoved.value = false;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_delete")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  onMounted(() => {
    fetchState();
    unsubscribeProviderEvent = api.subscribe(
      EventType.PROVIDER_EVENT,
      handleProviderEvent,
    );
  });

  onBeforeUnmount(() => {
    unsubscribeProviderEvent?.();
  });

  return {
    state,
    gameRemoved,
    busy,
    loading,
    currentRound,
    isLastRound,
    joinLink,
    phaseLabel,
    create,
    start,
    reveal,
    next,
    reset,
    deleteGame,
    fetchState,
  };
}
