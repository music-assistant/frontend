// Dashboard routes a dashboard viewer session may be pinned to. Anything else
// falls back to the party dashboard. Checked against the pathname only - a
// pinned route (e.g. /now-playing) may carry its own query string.
const DASHBOARD_VIEWER_ROUTES = new Set([
  "/party",
  "/music-quiz",
  "/now-playing",
]);

function pathnameOf(path: string): string {
  return path.split("?")[0] ?? path;
}

export function sanitizeDashboardViewerPath(path: string | null): string {
  return path && DASHBOARD_VIEWER_ROUTES.has(pathnameOf(path))
    ? path
    : "/party";
}

export function getDashboardViewerNavigationRedirect(
  isDashboardViewer: boolean,
  pinnedPath: string | null,
  path: string,
): string | undefined {
  if (isDashboardViewer && pinnedPath && path !== pinnedPath) {
    return pinnedPath;
  }
  return undefined;
}
