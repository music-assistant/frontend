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
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.setPositionState();
  navigator.mediaSession.playbackState = "none";
  for (const action of actions) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
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
