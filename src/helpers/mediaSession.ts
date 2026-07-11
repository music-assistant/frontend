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
    navigator.mediaSession.setActionHandler(action, null);
  }
}
