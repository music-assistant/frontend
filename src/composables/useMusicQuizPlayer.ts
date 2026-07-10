import {
  answerMusicQuiz,
  getMusicQuizInfo,
  getMusicQuizState,
  heartbeatMusicQuiz,
  isSupportedMusicQuiz,
  isMusicQuizProviderEvent,
  joinMusicQuiz,
  readyMusicQuiz,
  type MusicQuizAnswerSubmission,
  type MusicQuizCurrentRound,
  type MusicQuizInfo,
  type MusicQuizPersonalizedState,
  type MusicQuizPublicState,
} from "@/composables/useMusicQuiz";
import { createMusicQuizPlayerHeartbeat } from "@/composables/useMusicQuizPlayerHeartbeat";
import {
  clearStoredMusicQuizPlayerId,
  getStoredMusicQuizPlayerId,
  storeMusicQuizPlayerId,
  getMusicQuizErrorMessage,
  isNoActiveGameError,
} from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

export interface UseMusicQuizPlayerOptions {
  notifyError: (message: string) => void;
}

/** Manage Music Quiz guest state and player actions. */
export function useMusicQuizPlayer(options: UseMusicQuizPlayerOptions) {
  const { notifyError } = options;

  const info = ref<MusicQuizInfo | null>(null);
  const state = ref<MusicQuizPersonalizedState | null>(null);
  const playerId = ref<string | null>(null);
  const gameRemoved = ref(false);
  const busy = ref(false);
  const loading = ref(false);
  const providerInstanceId = ref<string | null>(null);
  const playerHeartbeat = createMusicQuizPlayerHeartbeat({
    sendHeartbeat: heartbeatMusicQuiz,
    onResult: handleHeartbeatResult,
    onError: handleHeartbeatError,
  });

  let unsubscribeProviderEvent: (() => void) | undefined;
  let reconnectPlayerId: string | null = null;
  let loadingRequestId = 0;

  const currentRound = computed<MusicQuizCurrentRound | null>(() => {
    const currentState = state.value;
    return currentState && isSupportedMusicQuiz(currentState)
      ? (currentState.current_round ?? null)
      : null;
  });

  const yourName = computed(() => {
    const currentState = state.value;
    return currentState && isSupportedMusicQuiz(currentState)
      ? currentState.you.name
      : "";
  });

  const players = computed(() => {
    const currentState = state.value;
    return currentState && isSupportedMusicQuiz(currentState)
      ? currentState.players
      : [];
  });

  async function fetchInfo() {
    const requestId = ++loadingRequestId;
    try {
      loading.value = true;
      const nextInfo = await getMusicQuizInfo();
      info.value = nextInfo;
      gameRemoved.value = !nextInfo;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(
          err,
          $t("providers.music_quiz.error_load_info"),
        ),
      );
    } finally {
      if (loadingRequestId === requestId) loading.value = false;
    }
  }

  async function fetchState() {
    const currentPlayerId = playerId.value;
    if (currentPlayerId) {
      if (reconnectPlayerId === currentPlayerId) {
        await heartbeat();
      } else {
        await fetchPlayerState(currentPlayerId);
      }
      return;
    }

    const storedPlayerId = getStoredMusicQuizPlayerId();
    if (storedPlayerId) {
      await reconnectPlayer(storedPlayerId);
    } else {
      await fetchInfo();
    }
  }

  async function join(name: string) {
    busy.value = true;
    try {
      const result = await joinMusicQuiz(name);
      storeMusicQuizPlayerId(result.player_id);
      state.value = result.state;
      gameRemoved.value = false;
      void startHeartbeat(result.player_id);
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_join")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function submitAnswer(submission: MusicQuizAnswerSubmission) {
    const currentPlayerId = playerId.value;
    if (!currentPlayerId) {
      notifyError($t("providers.music_quiz.error_not_joined"));
      return false;
    }
    busy.value = true;
    try {
      const nextState = await answerMusicQuiz(
        currentPlayerId,
        submission.suggestion_id,
      );
      state.value = nextState;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_answer")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function ready() {
    const currentPlayerId = playerId.value;
    if (!currentPlayerId) {
      notifyError($t("providers.music_quiz.error_not_joined"));
      return false;
    }
    busy.value = true;
    try {
      const nextState = await readyMusicQuiz(currentPlayerId);
      state.value = nextState;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_ready")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function leave() {
    clearActivePlayer();
  }

  onMounted(() => {
    void fetchState();
    unsubscribeProviderEvent = api.subscribe(
      EventType.PROVIDER_EVENT,
      handleProviderEvent,
    );
  });

  onBeforeUnmount(() => {
    stopHeartbeat();
    unsubscribeProviderEvent?.();
  });

  return {
    info,
    state,
    playerId,
    gameRemoved,
    busy,
    loading,
    currentRound,
    yourName,
    players,
    fetchInfo,
    fetchState,
    join,
    submitAnswer,
    ready,
    leave,
  };

  async function fetchPlayerState(currentPlayerId: string) {
    const requestId = ++loadingRequestId;
    try {
      loading.value = true;
      const nextState = await getMusicQuizState(currentPlayerId);
      if (playerId.value !== currentPlayerId) return;
      state.value = nextState;
      gameRemoved.value = false;
    } catch (err) {
      if (playerId.value !== currentPlayerId) return;
      if (
        isNoActiveGameError(err) ||
        getMusicQuizErrorMessage(err).toLowerCase().includes("player not found")
      ) {
        await resetToJoinInfo();
      } else {
        notifyError(
          getMusicQuizErrorMessage(
            err,
            $t("providers.music_quiz.error_load_state"),
          ),
        );
      }
    } finally {
      if (loadingRequestId === requestId) loading.value = false;
    }
  }

  function handleProviderEvent(event: { object_id?: string; data?: unknown }) {
    if (!isMusicQuizProviderEvent(event.data)) return;
    const payload = event.data;
    if (!isScopedProviderEvent(event.object_id)) return;
    if (payload.event === "game_updated") {
      if (isCurrentPlayerMissing(payload.state)) {
        void resetToJoinInfo();
      } else if (playerId.value || getStoredMusicQuizPlayerId()) {
        void fetchState();
      } else {
        void fetchInfo();
      }
    } else if (payload.event === "game_removed") {
      clearActivePlayer();
      gameRemoved.value = true;
    }
  }

  function isCurrentPlayerMissing(publicState: MusicQuizPublicState) {
    const currentState = state.value;
    if (
      !currentState ||
      !isSupportedMusicQuiz(currentState) ||
      !isSupportedMusicQuiz(publicState) ||
      !Array.isArray(publicState.players)
    ) {
      return false;
    }
    return !publicState.players.some(
      (player) => player.name === currentState.you.name,
    );
  }

  function isScopedProviderEvent(objectId?: string) {
    if (!objectId) return false;
    if (!providerInstanceId.value) {
      providerInstanceId.value = objectId;
      return true;
    }
    return providerInstanceId.value === objectId;
  }

  function reconnectPlayer(storedPlayerId: string) {
    return startHeartbeat(storedPlayerId, true);
  }

  function startHeartbeat(currentPlayerId: string, reconnecting = false) {
    playerId.value = currentPlayerId;
    reconnectPlayerId = reconnecting ? currentPlayerId : null;
    return playerHeartbeat.start(currentPlayerId);
  }

  function stopHeartbeat() {
    reconnectPlayerId = null;
    playerHeartbeat.stop();
  }

  function heartbeat() {
    const currentPlayerId = playerId.value;
    if (!currentPlayerId) return Promise.resolve();
    return playerHeartbeat.refresh();
  }

  async function handleHeartbeatResult(
    currentPlayerId: string,
    active: boolean,
  ) {
    if (playerId.value !== currentPlayerId) return;
    if (!active) {
      await resetToJoinInfo();
    } else if (reconnectPlayerId === currentPlayerId) {
      reconnectPlayerId = null;
      await fetchPlayerState(currentPlayerId);
    }
  }

  function handleHeartbeatError(currentPlayerId: string, err: unknown) {
    if (playerId.value !== currentPlayerId) return;
    notifyError(
      getMusicQuizErrorMessage(
        err,
        $t("providers.music_quiz.error_load_state"),
      ),
    );
  }

  function clearActivePlayer() {
    playerId.value = null;
    state.value = null;
    loadingRequestId += 1;
    loading.value = false;
    stopHeartbeat();
    clearStoredMusicQuizPlayerId();
  }

  async function resetToJoinInfo() {
    clearActivePlayer();
    await fetchInfo();
  }
}
