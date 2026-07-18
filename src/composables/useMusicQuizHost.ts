import {
  createMusicQuiz,
  deleteMusicQuiz,
  getAvailableMusicQuizTypes,
  getMusicQuiz,
  getMusicQuizPlaybackOptions,
  isSupportedMusicQuiz,
  isMusicQuizProviderEvent,
  nextMusicQuiz,
  resetMusicQuiz,
  revealMusicQuiz,
  startMusicQuiz,
  type MusicQuizCreateRequest,
  type MusicQuizCurrentRound,
  type MusicQuizHostState,
  type MusicQuizPlaybackOptions,
} from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  getMusicQuizErrorMessage,
  isNoActiveGameError,
} from "@/helpers/music_quiz";

export interface UseMusicQuizHostOptions {
  loadSetupData?: boolean;
  notifyError: (message: string) => void;
}

/**
 * Host-side Music Quiz management: single game per provider instance,
 * PROVIDER_EVENT driven (no polling). Fetches music_quiz/get on mount,
 * subscribes to PROVIDER_EVENT for the active provider instance
 * (game_updated -> re-fetch, game_removed -> clear), and wraps all host actions.
 */
export function useMusicQuizHost(options: UseMusicQuizHostOptions) {
  const { loadSetupData = true, notifyError } = options;

  const state = ref<MusicQuizHostState | null>(null);
  const busy = ref(false);
  const starting = ref(false);
  const loading = ref(false);
  const availableQuizTypes = ref<string[]>([]);
  const playbackOptions = ref<MusicQuizPlaybackOptions | null>(null);
  const playbackOptionsLoading = ref(false);
  const playbackOptionsLegacy = ref(false);
  const playbackOptionsError = ref(false);
  const providerInstanceId = ref<string | null>(null);

  let unsubscribeProviderEvent: (() => void) | undefined;
  let stateRequestId = 0;
  let playbackOptionsRequestId = 0;

  const currentRound = computed<MusicQuizCurrentRound | null>(() => {
    const currentState = state.value;
    return currentState && isSupportedMusicQuiz(currentState)
      ? (currentState.current_round ?? null)
      : null;
  });

  const isLastRound = computed(() => {
    const currentState = state.value;
    if (!currentState || !isSupportedMusicQuiz(currentState)) return false;
    return (
      currentState.current_round &&
      currentState.current_round.round_index >= currentState.round_count - 1
    );
  });

  const joinLink = computed(() => {
    const currentState = state.value;
    return currentState && isSupportedMusicQuiz(currentState)
      ? currentState.join_url
      : "";
  });

  async function fetchState() {
    const requestId = ++stateRequestId;
    try {
      loading.value = true;
      const nextState = await getMusicQuiz();
      if (requestId !== stateRequestId) return;
      state.value = nextState;
    } catch (err) {
      if (requestId !== stateRequestId) return;
      if (isNoActiveGameError(err)) {
        state.value = null;
      } else {
        notifyError(
          getMusicQuizErrorMessage(
            err,
            $t("providers.music_quiz.error_load_state"),
          ),
        );
      }
    } finally {
      if (requestId === stateRequestId) {
        loading.value = false;
      }
    }
  }

  async function fetchAvailableQuizTypes() {
    try {
      availableQuizTypes.value = await getAvailableMusicQuizTypes();
    } catch (err) {
      if (isUnknownCommandError(err)) {
        availableQuizTypes.value = [];
        return;
      }
      notifyError(
        getMusicQuizErrorMessage(
          err,
          $t("providers.music_quiz.error_load_game_types"),
        ),
      );
    }
  }

  async function fetchPlaybackOptions() {
    const requestId = ++playbackOptionsRequestId;
    playbackOptionsLoading.value = true;
    playbackOptionsLegacy.value = false;
    playbackOptionsError.value = false;
    try {
      const options = await getMusicQuizPlaybackOptions();
      if (requestId !== playbackOptionsRequestId) return;
      playbackOptions.value = options;
    } catch (err) {
      if (requestId !== playbackOptionsRequestId) return;
      if (isUnknownCommandError(err)) {
        playbackOptions.value = null;
        playbackOptionsLegacy.value = true;
      } else {
        playbackOptionsError.value = true;
        notifyError($t("providers.music_quiz.error_load_playback_options"));
      }
    } finally {
      if (requestId === playbackOptionsRequestId) {
        playbackOptionsLoading.value = false;
      }
    }
  }

  async function create(request: MusicQuizCreateRequest) {
    if (busy.value) return false;
    busy.value = true;
    try {
      const nextState = await createMusicQuiz(request);
      applyState(nextState);
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
    if (busy.value) return false;
    busy.value = true;
    starting.value = true;
    try {
      const nextState = await startMusicQuiz();
      applyState(nextState);
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_start")),
      );
      return false;
    } finally {
      starting.value = false;
      busy.value = false;
    }
  }

  async function reveal() {
    if (busy.value) return false;
    busy.value = true;
    try {
      const nextState = await revealMusicQuiz();
      applyState(nextState);
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
    if (busy.value) return false;
    busy.value = true;
    try {
      const nextState = await nextMusicQuiz();
      applyState(nextState);
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

  async function reset(autoStart = false) {
    if (busy.value) return false;
    busy.value = true;
    try {
      const nextState = await resetMusicQuiz(autoStart);
      applyState(nextState);
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

  async function replay() {
    if (busy.value) return false;
    busy.value = true;
    starting.value = true;
    let resetComplete = false;
    try {
      const lobbyState = await resetMusicQuiz(false);
      applyState(lobbyState);
      resetComplete = true;
      const nextState = await startMusicQuiz();
      applyState(nextState);
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(
          err,
          $t(
            resetComplete
              ? "providers.music_quiz.error_start"
              : "providers.music_quiz.error_reset",
          ),
        ),
      );
      return false;
    } finally {
      starting.value = false;
      busy.value = false;
    }
  }

  async function deleteGame() {
    if (busy.value) return false;
    busy.value = true;
    try {
      await deleteMusicQuiz();
      clearState();
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

  function handleProviderEvent(event: { object_id?: string; data?: unknown }) {
    if (!isMusicQuizProviderEvent(event.data)) return;
    const payload = event.data;
    if (!isScopedProviderEvent(event.object_id)) return;
    if (payload.event === "game_updated") {
      // Re-fetch on game_updated to get the latest host state
      void fetchState();
    } else if (payload.event === "game_removed") {
      clearState();
    }
  }

  function isScopedProviderEvent(objectId?: string) {
    if (!objectId) return false;
    if (!providerInstanceId.value) {
      providerInstanceId.value = objectId;
      return true;
    }
    return providerInstanceId.value === objectId;
  }

  function applyState(nextState: MusicQuizHostState) {
    stateRequestId++;
    state.value = nextState;
    loading.value = false;
  }

  function clearState() {
    stateRequestId++;
    state.value = null;
    loading.value = false;
  }

  onMounted(() => {
    fetchState();
    if (loadSetupData) {
      fetchAvailableQuizTypes();
      fetchPlaybackOptions();
    }
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
    busy,
    starting,
    loading,
    availableQuizTypes,
    playbackOptions,
    playbackOptionsLoading,
    playbackOptionsLegacy,
    playbackOptionsError,
    currentRound,
    isLastRound,
    joinLink,
    create,
    start,
    reveal,
    next,
    reset,
    replay,
    deleteGame,
    fetchState,
    fetchAvailableQuizTypes,
    fetchPlaybackOptions,
  };

  function isUnknownCommandError(err: unknown) {
    return getMusicQuizErrorMessage(err)
      .toLowerCase()
      .includes("invalid command");
  }
}
