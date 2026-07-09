/**
 * Routes that guest-access sessions (party + Music Quiz QR guests) may visit.
 * Everything else redirects them back to their guest view — this is the guard
 * that keeps a scanned-QR JWT out of the full Music Assistant UI.
 */
export function isGuestAccessAllowedRoute(path: string): boolean {
  return path === "/guest" || path === "/music-quiz/play";
}

/**
 * Where to send a guest-access session that landed on a disallowed route:
 * Music Quiz guests go back to their game, party guests to the party view.
 */
export function getGuestHomeRoute(isMusicQuizGuest: boolean): string {
  if (isMusicQuizGuest) {
    return "/music-quiz/play";
  }
  return "/guest";
}
