// Enumerate the exact guest routes rather than prefix-matching "/guest/" —
// the router has a catch-all not-found route, so an unmatched "/guest/x"
// would otherwise slip through the guard and render under the full UI layout.
const GUEST_ALLOWED_ROUTES = new Set([
  "/guest",
  "/guest/party",
  "/guest/quiz",
  "/music-quiz/play",
]);

export function isGuestAccessAllowedRoute(path: string): boolean {
  return GUEST_ALLOWED_ROUTES.has(path);
}

export function getGuestNavigationRedirect(
  isGuestAccessSession: boolean,
  path: string,
): string | undefined {
  if (isGuestAccessSession && !isGuestAccessAllowedRoute(path)) {
    return "/guest";
  }
  return undefined;
}
