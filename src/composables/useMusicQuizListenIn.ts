import {
  canListenInMusicQuiz,
  listenInMusicQuiz,
  stopListenInMusicQuiz,
  type MusicQuizMode,
} from "@/composables/useMusicQuiz";
import { getMusicQuizErrorMessage } from "@/helpers/music_quiz";
import { $t } from "@/plugins/i18n";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { webPlayer } from "@/plugins/web_player";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface UseMusicQuizListenInOptions {
  mode: () => MusicQuizMode | undefined;
  notifyError: (message: string) => void;
}

/**
 * Music Quiz listen-in: manages web player registration, can_listen_in checking,
 * and mode-aware UX (venue = opt-in toggle; remote = prominent/default-on).
 * Re-checks can_listen_in on: own web player updates, every game_updated event, and mount.
 */
export function useMusicQuizListenIn(options: UseMusicQuizListenInOptions) {
  const { mode, notifyError } = options;

  const canListenIn = ref(false);
  const isListeningIn = ref(false);
  const busy = ref(false);

  let unsubscribePlayerUpdated: (() => void) | undefined;
  let unsubscribeProviderEvent: (() => void) | undefined;

  const webPlayerId = computed(() => webPlayer.player_id ?? null);

  const shouldShowListenInToggle = computed(() => {
    return canListenIn.value && mode() !== undefined;
  });

  const shouldPromptListenIn = computed(() => {
    // remote mode: prominent/default-on (opt-out)
    return mode() === "remote" && canListenIn.value && !isListeningIn.value;
  });

  async function checkCanListenIn() {
    const playerId = webPlayerId.value;
    if (!playerId) {
      canListenIn.value = false;
      return;
    }
    try {
      const result = await canListenInMusicQuiz(playerId);
      canListenIn.value = result;
    } catch (err) {
      // can_listen_in failures are not critical, just log
      console.debug("can_listen_in check failed:", err);
      canListenIn.value = false;
    }
  }

  async function enableListenIn() {
    const playerId = webPlayerId.value;
    if (!playerId) {
      notifyError($t("music_quiz.error_no_web_player"));
      return false;
    }
    busy.value = true;
    try {
      await listenInMusicQuiz(playerId);
      isListeningIn.value = true;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("music_quiz.error_listen_in")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function disableListenIn() {
    const playerId = webPlayerId.value;
    if (!playerId) return false;
    busy.value = true;
    try {
      await stopListenInMusicQuiz(playerId);
      isListeningIn.value = false;
      return true;
    } catch (err) {
      notifyError(
        getMusicQuizErrorMessage(err, $t("music_quiz.error_stop_listen_in")),
      );
      return false;
    } finally {
      busy.value = false;
    }
  }

  function handlePlayerUpdated(event: { object_id?: string }) {
    // Only re-check if the update is for our own web player
    if (event.object_id === webPlayerId.value) {
      checkCanListenIn();
    }
  }

  function handleProviderEvent() {
    // Re-check on every game_updated event
    checkCanListenIn();
  }

  watch(webPlayerId, (newPlayerId) => {
    // Re-check when web player becomes available or changes
    if (newPlayerId) {
      checkCanListenIn();
    } else {
      canListenIn.value = false;
      isListeningIn.value = false;
    }
  });

  onMounted(() => {
    checkCanListenIn();
    unsubscribePlayerUpdated = api.subscribe_multi(
      [EventType.PLAYER_UPDATED, EventType.PLAYER_ADDED],
      handlePlayerUpdated,
    );
    unsubscribeProviderEvent = api.subscribe(
      EventType.PROVIDER_EVENT,
      handleProviderEvent,
    );
  });

  onBeforeUnmount(() => {
    unsubscribePlayerUpdated?.();
    unsubscribeProviderEvent?.();
  });

  return {
    canListenIn,
    isListeningIn,
    busy,
    shouldShowListenInToggle,
    shouldPromptListenIn,
    enableListenIn,
    disableListenIn,
    checkCanListenIn,
  };
}
