export function isGuestAccessAllowedRoute(path: string): boolean {
  return (
    path === "/guest" ||
    path.startsWith("/guest/") ||
    path === "/music-quiz/play"
  );
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
