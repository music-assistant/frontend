const HEARTBEAT_INTERVAL_MS = 15_000;

interface MusicQuizPlayerHeartbeatOptions {
  sendHeartbeat: (playerId: string) => Promise<boolean>;
  onResult: (playerId: string, active: boolean) => Promise<void> | void;
  onError: (playerId: string, error: unknown) => void;
}

/** Schedule non-overlapping heartbeats for the active Music Quiz player. */
export function createMusicQuizPlayerHeartbeat(
  options: MusicQuizPlayerHeartbeatOptions,
) {
  const { sendHeartbeat, onResult, onError } = options;

  let activePlayerId: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let request: Promise<void> | undefined;
  let requestTask: Promise<void> | undefined;
  let requestQueued = false;
  let notifiedErrorPlayerId: string | null = null;

  function start(playerId: string) {
    stop();
    activePlayerId = playerId;
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refresh);
    timer = setInterval(() => void refresh(), HEARTBEAT_INTERVAL_MS);
    return refresh();
  }

  function stop() {
    activePlayerId = null;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    request = undefined;
    requestTask = undefined;
    requestQueued = false;
    notifiedErrorPlayerId = null;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", refresh);
  }

  function refresh() {
    const playerId = activePlayerId;
    if (!playerId) return Promise.resolve();
    if (request) {
      requestQueued = true;
      return requestTask ?? request;
    }

    const outcome = Promise.resolve()
      .then(() => sendHeartbeat(playerId))
      .then(
        (active) => ({ active }) as const,
        (error: unknown) => ({ error }) as const,
      );
    const pendingTask = outcome.then(async (result) => {
      if ("error" in result) {
        reportError(playerId, result.error);
      } else if (activePlayerId === playerId) {
        notifiedErrorPlayerId = null;
        try {
          await onResult(playerId, result.active);
        } catch (error) {
          if (activePlayerId === playerId) {
            reportError(playerId, error);
          } else {
            console.error("[Music Quiz] Heartbeat callback failed", error);
          }
        }
      }
    });
    const trackedTask = pendingTask.finally(() => {
      if (requestTask === trackedTask) requestTask = undefined;
    });
    const pendingRequest = outcome.then(() => undefined);
    const trackedRequest = pendingRequest.finally(() => {
      if (request !== trackedRequest) return;
      request = undefined;
      const shouldRetry = requestQueued;
      requestQueued = false;
      if (shouldRetry && activePlayerId) void refresh();
    });
    requestTask = trackedTask;
    request = trackedRequest;
    return trackedTask;
  }

  return { start, stop, refresh };

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") void refresh();
  }

  function reportError(playerId: string, error: unknown) {
    if (activePlayerId !== playerId || notifiedErrorPlayerId === playerId)
      return;
    notifiedErrorPlayerId = playerId;
    try {
      onError(playerId, error);
    } catch (handlerError) {
      console.error(
        "[Music Quiz] Heartbeat error handler failed",
        handlerError,
      );
    }
  }
}
