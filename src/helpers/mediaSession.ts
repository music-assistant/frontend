import type { RouteLocationNormalizedLoaded } from "vue-router";

const actions: MediaSessionAction[] = [
  "play",
  "pause",
  "nexttrack",
  "previoustrack",
  "seekto",
  "seekforward",
  "seekbackward",
];

export function isMediaSessionDisabled(
  route: Pick<RouteLocationNormalizedLoaded, "meta">,
  isGuestAccessSession: boolean,
): boolean {
  return (
    !navigator.mediaSession ||
    isGuestAccessSession ||
    route.meta.disableMediaSession === true
  );
}

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
