import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { webPlayer } from "@/plugins/web_player";

let nextListenInOperationId = 0;
const latestListenInOperationByPlayer = new Map<string, number>();

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
  /** Whether Listen-in should start as soon as it becomes available. */
  autoEnable?: () => boolean;
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
    autoEnable,
  } = options;
  const getErrorMessage = options.getErrorMessage ?? defaultGetErrorMessage;

  const canListenIn = ref(false);
  const isListeningIn = ref(false);
  const busy = ref(false);

  let unsubscribePlayerUpdated: (() => void) | undefined;
  let unsubscribeRecheckEvents: (() => void) | undefined;
  let autoEnableAttemptedForGeneration: number | null = null;
  let availabilityRequestId = 0;
  let disposed = false;

  const webPlayerId = computed(() => webPlayer.player_id ?? null);
  const webPlayerGeneration = computed(() => webPlayer.player_generation);

  const shouldShowListenInToggle = computed(
    () => canListenIn.value && mode() !== undefined,
  );

  const shouldPromptListenIn = computed(
    () => mode() === "remote" && canListenIn.value && !isListeningIn.value,
  );

  async function checkCanListenIn() {
    const requestId = ++availabilityRequestId;
    const playerId = webPlayerId.value;
    const playerGeneration = webPlayerGeneration.value;
    if (!playerId) {
      canListenIn.value = false;
      return;
    }
    try {
      const available = await api.sendCommand<boolean>(
        `${domain}/can_listen_in`,
        { web_player_id: playerId },
        // Availability is best-effort; failures are handled below.
        { suppressGlobalError: true },
      );
      if (
        disposed ||
        requestId !== availabilityRequestId ||
        !isCurrentWebPlayer(playerId, playerGeneration)
      ) {
        return;
      }
      canListenIn.value = available;
      if (
        canListenIn.value &&
        autoEnable?.() &&
        autoEnableAttemptedForGeneration !== playerGeneration &&
        !isListeningIn.value &&
        !busy.value
      ) {
        autoEnableAttemptedForGeneration = playerGeneration;
        await enableListenIn();
      }
    } catch (err) {
      if (
        requestId !== availabilityRequestId ||
        !isCurrentWebPlayer(playerId, playerGeneration)
      ) {
        return;
      }
      // Availability is best-effort; on failure just treat it as unavailable.
      console.debug("can_listen_in check failed:", err);
      canListenIn.value = false;
    }
  }

  async function enableListenIn() {
    if (busy.value) return false;
    const playerId = webPlayerId.value;
    const playerGeneration = webPlayerGeneration.value;
    if (!playerId) {
      notifyError(errorMessages.noWebPlayer);
      return false;
    }
    // Unlock this browser's audio output within the user gesture; listen-in
    // audio starts asynchronously and would otherwise be blocked on iOS.
    if (!webPlayer.primeAudio()) {
      notifyError(errorMessages.noWebPlayer);
      return false;
    }
    const operationId = beginListenInOperation(domain, playerId);
    busy.value = true;
    try {
      await api.sendCommand<void>(`${domain}/listen_in`, {
        web_player_id: playerId,
      });
      if (
        !isCurrentWebPlayer(playerId, playerGeneration) ||
        !isLatestListenInOperation(domain, playerId, operationId)
      ) {
        if (isLatestListenInOperation(domain, playerId, operationId)) {
          await stopStaleListenIn(playerId);
        }
        return false;
      }
      isListeningIn.value = true;
      return true;
    } catch (err) {
      if (
        isCurrentWebPlayer(playerId, playerGeneration) &&
        isLatestListenInOperation(domain, playerId, operationId)
      ) {
        notifyError(getErrorMessage(err, errorMessages.listenIn));
      }
      return false;
    } finally {
      busy.value = false;
      if (
        !disposed &&
        webPlayerId.value &&
        !isCurrentWebPlayer(playerId, playerGeneration) &&
        isLatestListenInOperation(domain, playerId, operationId)
      ) {
        void checkCanListenIn();
      }
    }
  }

  async function disableListenIn() {
    if (busy.value) return false;
    const playerId = webPlayerId.value;
    const playerGeneration = webPlayerGeneration.value;
    if (!playerId) return false;
    const operationId = beginListenInOperation(domain, playerId);
    busy.value = true;
    try {
      await api.sendCommand<void>(`${domain}/stop_listen_in`, {
        web_player_id: playerId,
      });
      if (
        !isCurrentWebPlayer(playerId, playerGeneration) ||
        !isLatestListenInOperation(domain, playerId, operationId)
      ) {
        return false;
      }
      isListeningIn.value = false;
      return true;
    } catch (err) {
      if (
        isCurrentWebPlayer(playerId, playerGeneration) &&
        isLatestListenInOperation(domain, playerId, operationId)
      ) {
        notifyError(getErrorMessage(err, errorMessages.stopListenIn));
      }
      return false;
    } finally {
      busy.value = false;
      if (
        !disposed &&
        webPlayerId.value &&
        !isCurrentWebPlayer(playerId, playerGeneration) &&
        isLatestListenInOperation(domain, playerId, operationId)
      ) {
        void checkCanListenIn();
      }
    }
  }

  function handlePlayerUpdated(event: { object_id?: string }) {
    // Only react to updates for our own web player.
    if (event.object_id === webPlayerId.value) {
      checkCanListenIn();
    }
  }

  watch([webPlayerId, webPlayerGeneration], ([newPlayerId]) => {
    availabilityRequestId++;
    autoEnableAttemptedForGeneration = null;
    canListenIn.value = false;
    isListeningIn.value = false;
    if (newPlayerId) {
      checkCanListenIn();
    }
  });

  function isCurrentWebPlayer(playerId: string, generation: number) {
    return (
      !disposed &&
      webPlayerId.value === playerId &&
      webPlayerGeneration.value === generation
    );
  }

  async function stopStaleListenIn(playerId: string) {
    try {
      await api.sendCommand<void>(`${domain}/stop_listen_in`, {
        web_player_id: playerId,
      });
    } catch (error) {
      console.debug("Could not stop stale listen-in session:", error);
    }
  }

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
    disposed = true;
    availabilityRequestId++;
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

function beginListenInOperation(domain: string, playerId: string) {
  const operationId = ++nextListenInOperationId;
  latestListenInOperationByPlayer.set(`${domain}:${playerId}`, operationId);
  return operationId;
}

function isLatestListenInOperation(
  domain: string,
  playerId: string,
  operationId: number,
) {
  return (
    latestListenInOperationByPlayer.get(`${domain}:${playerId}`) === operationId
  );
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
