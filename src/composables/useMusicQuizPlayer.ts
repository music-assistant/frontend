import {
  answerMusicQuiz,
  getMusicQuizInfo,
  getMusicQuizState,
  heartbeatMusicQuiz,
  isSupportedMusicQuiz,
  isMusicQuizProviderEvent,
  joinMusicQuiz,
  readyMusicQuiz,
  submitMusicQuizAnswer,
  type MusicQuizAnswerSubmission,
  type MusicQuizCurrentRound,
  type MusicQuizInfo,
  type MusicQuizPersonalizedState,
  type MusicQuizPublicState,
} from "@/composables/useMusicQuiz";
import { createMusicQuizPlayerHeartbeat } from "@/composables/useMusicQuizPlayerHeartbeat";
import {
  createLocalConnectionIdentity,
  createRemoteConnectionIdentity,
} from "@/helpers/connection_identity";
import {
  clearStoredMusicQuizPlayerId,
  getStoredMusicQuizPlayerName,
  getStoredMusicQuizPlayerId,
  getMusicQuizErrorMessage,
  isNoActiveGameError,
  storeMusicQuizPlayerId,
  storeMusicQuizPlayerName,
  type MusicQuizParticipantStorageContext,
} from "@/helpers/music_quiz";
import { markMusicQuizJoinedGameEnded } from "@/helpers/music_quiz_guest_state";
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { remoteConnectionManager } from "@/plugins/remote";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

export interface UseMusicQuizPlayerOptions {
  notifyError: (message: string) => void;
}

/**
 * Manage Music Quiz participant state, player actions, and reconnection.
 *
 * Keeps joined players active and synchronizes state from provider events.
 */
export function useMusicQuizPlayer(options: UseMusicQuizPlayerOptions) {
  const { notifyError } = options;

  const info = ref<MusicQuizInfo | null>(null);
  const state = ref<MusicQuizPersonalizedState | null>(null);
  const playerId = ref<string | null>(null);
  const participantStorageContext = getParticipantStorageContext();
  const rememberedName = ref(
    getStoredMusicQuizPlayerName(participantStorageContext),
  );
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
  let joinedGame = false;
  let requestedPlayerStateId: string | null = null;
  let playerStateResolutionPromise: Promise<boolean> | null = null;
  let loadingRequestId = 0;
  let gameGeneration = 0;
  let autoJoinAttemptedGeneration: number | null = null;
  const activeJoinRequests = new Map<number, number>();
  let disposed = false;

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
      if (disposed || loadingRequestId !== requestId) return;
      info.value = nextInfo;
      if (nextInfo) joinedGame = false;
      gameRemoved.value = !nextInfo && joinedGame;
      if (nextInfo) await attemptAutoJoin();
    } catch (err) {
      if (disposed || loadingRequestId !== requestId) return;
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

    const storedPlayerId = getStoredMusicQuizPlayerId(
      participantStorageContext,
    );
    if (storedPlayerId) {
      joinedGame = true;
      await reconnectPlayer(storedPlayerId);
    } else {
      await fetchInfo();
    }
  }

  async function join(name: string) {
    if (busy.value) return false;
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    const joined = await performJoin(trimmedName, true, gameGeneration);
    if (joined) {
      autoJoinAttemptedGeneration = gameGeneration;
      rememberedName.value = trimmedName;
      storeMusicQuizPlayerName(trimmedName, participantStorageContext);
    }
    return joined;
  }

  async function submitAnswer(submission: MusicQuizAnswerSubmission) {
    if (busy.value) return false;
    const currentPlayerId = playerId.value;
    if (!currentPlayerId) {
      notifyError($t("providers.music_quiz.error_not_joined"));
      return false;
    }
    busy.value = true;
    try {
      if (submission.answer_type === "multiple_choice") {
        await answerMusicQuiz(currentPlayerId, submission.suggestion_id);
      } else {
        await submitMusicQuizAnswer(currentPlayerId, submission);
      }
      const refreshed = await fetchPlayerState(currentPlayerId);
      if (!refreshed && playerId.value === currentPlayerId) state.value = null;
      return refreshed;
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
    if (busy.value) return false;
    const currentPlayerId = playerId.value;
    if (!currentPlayerId) {
      notifyError($t("providers.music_quiz.error_not_joined"));
      return false;
    }
    busy.value = true;
    try {
      await readyMusicQuiz(currentPlayerId);
      const refreshed = await fetchPlayerState(currentPlayerId);
      if (!refreshed && playerId.value === currentPlayerId) state.value = null;
      return refreshed;
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
    joinedGame = false;
    gameRemoved.value = false;
  }

  onMounted(() => {
    void fetchState();
    unsubscribeProviderEvent = api.subscribe(
      EventType.PROVIDER_EVENT,
      handleProviderEvent,
    );
  });

  onBeforeUnmount(() => {
    disposed = true;
    gameGeneration += 1;
    loadingRequestId += 1;
    requestedPlayerStateId = null;
    stopHeartbeat();
    unsubscribeProviderEvent?.();
  });

  return {
    info,
    state,
    playerId,
    rememberedName,
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

  function fetchPlayerState(currentPlayerId: string) {
    requestedPlayerStateId = currentPlayerId;
    loadingRequestId += 1;
    playerStateResolutionPromise ??= processPlayerStateRequests().finally(
      () => {
        playerStateResolutionPromise = null;
      },
    );
    return playerStateResolutionPromise;
  }

  async function processPlayerStateRequests(): Promise<boolean> {
    while (requestedPlayerStateId) {
      const currentPlayerId = requestedPlayerStateId;
      if (playerId.value !== currentPlayerId) {
        requestedPlayerStateId = null;
        return false;
      }
      const requestId = loadingRequestId;
      try {
        loading.value = true;
        const nextState = await getMusicQuizState(currentPlayerId);
        if (
          loadingRequestId !== requestId ||
          requestedPlayerStateId !== currentPlayerId ||
          playerId.value !== currentPlayerId
        ) {
          continue;
        }
        state.value = nextState;
        gameRemoved.value = false;
        return true;
      } catch (err) {
        if (
          loadingRequestId !== requestId ||
          requestedPlayerStateId !== currentPlayerId ||
          playerId.value !== currentPlayerId
        ) {
          continue;
        }
        if (
          isNoActiveGameError(err) ||
          getMusicQuizErrorMessage(err)
            .toLowerCase()
            .includes("player not found")
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
        return false;
      } finally {
        if (loadingRequestId === requestId) loading.value = false;
      }
    }
    return false;
  }

  function handleProviderEvent(event: { object_id?: string; data?: unknown }) {
    if (!isMusicQuizProviderEvent(event.data)) return;
    const payload = event.data;
    if (!isScopedProviderEvent(event.object_id)) return;
    if (payload.event === "game_updated") {
      if (isCurrentPlayerMissing(payload.state)) {
        void resetToJoinInfo();
      } else if (
        playerId.value ||
        getStoredMusicQuizPlayerId(participantStorageContext)
      ) {
        void fetchState();
      } else {
        void fetchInfo();
      }
    } else if (payload.event === "game_removed") {
      const wasJoined = joinedGame || !!playerId.value;
      if (wasJoined) markMusicQuizJoinedGameEnded();
      gameGeneration += 1;
      autoJoinAttemptedGeneration = null;
      clearActivePlayer();
      busy.value = false;
      joinedGame = false;
      gameRemoved.value = wasJoined;
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
    if (disposed || playerId.value !== currentPlayerId) return;
    if (!active) {
      await resetToJoinInfo();
    } else if (reconnectPlayerId === currentPlayerId) {
      reconnectPlayerId = null;
      await fetchPlayerState(currentPlayerId);
    }
  }

  function handleHeartbeatError(currentPlayerId: string, err: unknown) {
    if (disposed || playerId.value !== currentPlayerId) return;
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
    requestedPlayerStateId = null;
    loadingRequestId += 1;
    loading.value = false;
    stopHeartbeat();
    clearStoredMusicQuizPlayerId();
  }

  function applyPlayerState(nextState: MusicQuizPersonalizedState) {
    loadingRequestId += 1;
    state.value = nextState;
    loading.value = false;
  }

  async function resetToJoinInfo() {
    clearActivePlayer();
    await fetchInfo();
  }

  async function performJoin(
    name: string,
    notifyJoinError: boolean,
    requestGeneration: number,
  ) {
    activeJoinRequests.set(
      requestGeneration,
      (activeJoinRequests.get(requestGeneration) ?? 0) + 1,
    );
    busy.value = true;
    try {
      const result = await joinMusicQuiz(name);
      if (disposed || requestGeneration !== gameGeneration) return false;
      storeMusicQuizPlayerId(result.player_id, participantStorageContext);
      joinedGame = true;
      applyPlayerState(result.state);
      gameRemoved.value = false;
      void startHeartbeat(result.player_id);
      return true;
    } catch (err) {
      if (
        !disposed &&
        notifyJoinError &&
        requestGeneration === gameGeneration
      ) {
        notifyError(
          getMusicQuizErrorMessage(err, $t("providers.music_quiz.error_join")),
        );
      }
      return false;
    } finally {
      const remainingRequests =
        (activeJoinRequests.get(requestGeneration) ?? 1) - 1;
      if (remainingRequests > 0) {
        activeJoinRequests.set(requestGeneration, remainingRequests);
      } else {
        activeJoinRequests.delete(requestGeneration);
      }
      if (requestGeneration === gameGeneration) {
        busy.value = remainingRequests > 0;
      }
    }
  }

  function getParticipantStorageContext():
    | MusicQuizParticipantStorageContext
    | undefined {
    const connectionIdentity = api.isRemoteConnection.value
      ? createRemoteConnectionIdentity(
          remoteConnectionManager.currentRemoteId.value,
        )
      : createLocalConnectionIdentity(api.baseUrl);
    const participantIdentity =
      authManager.getClaim("jti") || store.currentUser?.user_id;
    return connectionIdentity && participantIdentity
      ? { connectionIdentity, participantIdentity }
      : undefined;
  }

  async function attemptAutoJoin() {
    const name = rememberedName.value;
    const requestGeneration = gameGeneration;
    if (
      !name ||
      disposed ||
      busy.value ||
      playerId.value ||
      autoJoinAttemptedGeneration === requestGeneration
    ) {
      return;
    }
    autoJoinAttemptedGeneration = requestGeneration;
    await performJoin(name, false, requestGeneration);
  }
}
