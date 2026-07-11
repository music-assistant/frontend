const actions: MediaSessionAction[] = [
  "play",
  "pause",
  "nexttrack",
  "previoustrack",
  "seekto",
  "seekforward",
  "seekbackward",
];

export function resetMediaSession(): void {
  const session = navigator.mediaSession;
  if (!session) return;

  session.metadata = null;
  session.setPositionState();
  session.playbackState = "none";
  for (const action of actions) {
    try {
      session.setActionHandler(action, null);
    } catch (error) {
      if (
        !(error instanceof DOMException) ||
        error.name !== "NotSupportedError"
      ) {
        throw error;
      }
    }
  }
}
