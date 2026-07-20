// Dashboard routes a dashboard viewer session may be pinned to. Anything else
// falls back to the party dashboard.
const DASHBOARD_VIEWER_ROUTES = new Set(["/party", "/music-quiz"]);

export function sanitizeDashboardViewerPath(path: string | null): string {
  return path && DASHBOARD_VIEWER_ROUTES.has(path) ? path : "/party";
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
