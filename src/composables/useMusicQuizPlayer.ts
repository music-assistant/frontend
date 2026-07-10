import {
  answerMusicQuiz,
  getMusicQuizInfo,
  getMusicQuizState,
  joinMusicQuiz,
  readyMusicQuiz,
  type MusicQuizCurrentRound,
  type MusicQuizInfo,
  type MusicQuizPersonalizedState,
} from "@/composables/useMusicQuiz";
import {
  clearStoredMusicQuizPlayerId,
  getStoredMusicQuizPlayerId,
  storeMusicQuizPlayerId,
  getMusicQuizErrorMessage,
  isNoActiveGameError,
  isMusicQuizPlayerNotFoundError,
} from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

export interface UseMusicQuizPlayerOptions {
  notifyError: (message: string) => void;
}

/**
 * Player-side Music Quiz: manages the guest's player_id credential,
 * fetches info for landing screen, joins the game, and subscribes to
 * PROVIDER_EVENT for real-time state updates. Players are keyed by name.
 */
export function useMusicQuizPlayer(options: UseMusicQuizPlayerOptions) {
  const { notifyError } = options;

  const info = ref<MusicQuizInfo | null>(null);
  const state = ref<MusicQuizPersonalizedState | null>(null);
  const playerId = ref<string | null>(null);
  const gameRemoved = ref(false);
  const busy = ref(false);
  const loading = ref(false);
  const providerInstanceId = ref<string | null>(null);

  let unsubscribeProviderEvent: (() => void) | undefined;

  const currentRound = computed<MusicQuizCurrentRound | null>(() => {
    return state.value?.current_round ?? null;
  });

  const yourName = computed(() => state.value?.you.name ?? "");

  const players = computed(() => state.value?.players ?? []);

  async function fetchInfo() {
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
      loading.value = false;
    }
  }

  async function fetchState() {
    const storedPlayerId = playerId.value ?? getStoredMusicQuizPlayerId();
    if (!storedPlayerId) {
      await fetchInfo();
      return;
    }
    try {
      loading.value = true;
      const nextState = await getMusicQuizState(storedPlayerId);
      state.value = nextState;
      playerId.value = storedPlayerId;
      gameRemoved.value = false;
    } catch (err) {
      if (
        isNoActiveGameError(err) ||
        isMusicQuizPlayerNotFoundError(err)
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
      loading.value = false;
    }
  }

  function handleProviderEvent(event: { object_id?: string; data?: unknown }) {
    if (!event.data || typeof event.data !== "object") return;
    const payload = event.data as {
      event?: string;
      state?: MusicQuizPersonalizedState;
    };
    if (payload.event !== "game_updated" && payload.event !== "game_removed") {
      return;
    }
    if (!isScopedProviderEvent(event.object_id)) return;
    if (payload.event === "game_updated") {
      if (playerId.value || getStoredMusicQuizPlayerId()) {
        void fetchState();
      } else {
        void fetchInfo();
      }
    } else if (payload.event === "game_removed") {
      state.value = null;
      playerId.value = null;
      clearStoredMusicQuizPlayerId();
      gameRemoved.value = true;
    }
  }

  async function join(name: string) {
    busy.value = true;
    try {
      const result = await joinMusicQuiz(name);
      playerId.value = result.player_id;
      storeMusicQuizPlayerId(result.player_id);
      state.value = result.state;
      gameRemoved.value = false;
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

  async function answer(suggestionId: string) {
    const currentPlayerId = playerId.value;
    if (!currentPlayerId) {
      notifyError($t("providers.music_quiz.error_not_joined"));
      return false;
    }
    busy.value = true;
    try {
      const nextState = await answerMusicQuiz(currentPlayerId, suggestionId);
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
    playerId.value = null;
    state.value = null;
    clearStoredMusicQuizPlayerId();
  }

  async function resetToJoinInfo() {
    state.value = null;
    playerId.value = null;
    clearStoredMusicQuizPlayerId();
    await fetchInfo();
  }

  function isScopedProviderEvent(objectId?: string) {
    if (!objectId) return false;
    if (!providerInstanceId.value) {
      providerInstanceId.value = objectId;
      return true;
    }
    return providerInstanceId.value === objectId;
  }

  onMounted(() => {
    // Check for stored player_id on mount (reconnect scenario)
    const storedPlayerId = getStoredMusicQuizPlayerId();
    if (storedPlayerId) {
      playerId.value = storedPlayerId;
      fetchState();
    } else {
      fetchInfo();
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
    answer,
    ready,
    leave,
  };
}
