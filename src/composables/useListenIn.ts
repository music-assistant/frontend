import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { webPlayer } from "@/plugins/web_player";

export type ListenInMode = "venue" | "remote";

export interface ListenInErrorMessages {
  noWebPlayer: string;
  listenIn: string;
  stopListenIn: string;
}

export interface UseListenInOptions {
  /** Command namespace, e.g. "party" or "music_quiz". */
  domain: string;
  /** Current experience mode; `undefined` hides the toggle/prompt. */
  mode: () => ListenInMode | undefined;
  notifyError: (message: string) => void;
  /** Fallback messages shown when a listen-in command fails. */
  errorMessages: ListenInErrorMessages;
  /**
   * Extra events that should trigger a can_listen_in re-check, on top of our own
   * web player updates and mount (e.g. the domain's state-changed event).
   */
  recheckEvents?: EventType[];
  /** Optional server-error extractor; defaults to a generic message reader. */
  getErrorMessage?: (err: unknown, fallback: string) => string;
}

/**
 * Shared "listen in" logic: streams the domain's audio to this browser's web player.
 * Tracks whether listening-in is possible (`canListenIn`) and active (`isListeningIn`),
 * and exposes mode-aware UX flags: `shouldShowListenInToggle` (venue = opt-in) and
 * `shouldPromptListenIn` (remote = default-on). Availability is re-checked on our own
 * web player updates, the given `recheckEvents`, and on mount.
 */
export function useListenIn(options: UseListenInOptions) {
  const {
    domain,
    mode,
    notifyError,
    errorMessages,
    recheckEvents = [],
  } = options;
  const getErrorMessage = options.getErrorMessage ?? defaultGetErrorMessage;

  const canListenIn = ref(false);
  const isListeningIn = ref(false);
  const busy = ref(false);

  let unsubscribePlayerUpdated: (() => void) | undefined;
  let unsubscribeRecheckEvents: (() => void) | undefined;

  const webPlayerId = computed(() => webPlayer.player_id ?? null);

  const shouldShowListenInToggle = computed(
    () => canListenIn.value && mode() !== undefined,
  );

  const shouldPromptListenIn = computed(
    () => mode() === "remote" && canListenIn.value && !isListeningIn.value,
  );

  async function checkCanListenIn() {
    const playerId = webPlayerId.value;
    if (!playerId) {
      canListenIn.value = false;
      return;
    }
    try {
      canListenIn.value = await api.sendCommand<boolean>(
        `${domain}/can_listen_in`,
        { web_player_id: playerId },
      );
    } catch (err) {
      // Availability is best-effort; on failure just treat it as unavailable.
      console.debug("can_listen_in check failed:", err);
      canListenIn.value = false;
    }
  }

  async function enableListenIn() {
    const playerId = webPlayerId.value;
    if (!playerId) {
      notifyError(errorMessages.noWebPlayer);
      return false;
    }
    busy.value = true;
    try {
      await api.sendCommand<void>(`${domain}/listen_in`, {
        web_player_id: playerId,
      });
      isListeningIn.value = true;
      return true;
    } catch (err) {
      notifyError(getErrorMessage(err, errorMessages.listenIn));
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
      await api.sendCommand<void>(`${domain}/stop_listen_in`, {
        web_player_id: playerId,
      });
      isListeningIn.value = false;
      return true;
    } catch (err) {
      notifyError(getErrorMessage(err, errorMessages.stopListenIn));
      return false;
    } finally {
      busy.value = false;
    }
  }

  function handlePlayerUpdated(event: { object_id?: string }) {
    // Only react to updates for our own web player.
    if (event.object_id === webPlayerId.value) {
      checkCanListenIn();
    }
  }

  watch(webPlayerId, (newPlayerId) => {
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
    if (recheckEvents.length > 0) {
      unsubscribeRecheckEvents = api.subscribe_multi(recheckEvents, () =>
        checkCanListenIn(),
      );
    }
  });

  onBeforeUnmount(() => {
    unsubscribePlayerUpdated?.();
    unsubscribeRecheckEvents?.();
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

function defaultGetErrorMessage(err: unknown, fallback = ""): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const details =
      "details" in err && typeof err.details === "string" ? err.details : "";
    const message =
      "message" in err && typeof err.message === "string" ? err.message : "";
    return details || message || fallback;
  }
  return fallback;
}
