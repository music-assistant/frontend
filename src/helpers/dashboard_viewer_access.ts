// Routes a dashboard viewer may be pinned to (else falls back to /party); matched by pathname only since a pinned route can carry a query string.
const DASHBOARD_VIEWER_ROUTES = new Set([
  "/party",
  // kept alongside the kiosk view: an older server still pins viewers here
  "/music-quiz",
  "/music-quiz/dashboard",
  "/now-playing",
]);

// Route params the viewer needs to identify itself and what it is showing.
const VIEWER_ROUTE_PARAMS = ["player", "dashboard_id"] as const;

// The dashboard kind the server knows each route by.
export type DashboardKind = "now_playing" | "music_quiz" | "party";
const DASHBOARD_KIND_BY_PREFIX: ReadonlyArray<[string, DashboardKind]> = [
  ["/now-playing", "now_playing"],
  ["/music-quiz", "music_quiz"],
];
const DEFAULT_DASHBOARD_KIND: DashboardKind = "party";

/** Which dashboard a viewer route is showing, as the server names it. */
export function dashboardKindForPath(path: string): DashboardKind {
  const match = DASHBOARD_KIND_BY_PREFIX.find(([prefix]) =>
    path.startsWith(prefix),
  );
  return match ? match[1] : DEFAULT_DASHBOARD_KIND;
}

function pathnameOf(path: string): string {
  return path.split("?")[0] ?? path;
}

/**
 * Put back route params that a double-decoding client stranded at the top level.
 *
 * Fully Kiosk decodes the url it is told to load once more before opening it, which
 * flattens the route's own query into the outer one: the path then stops at the first
 * "&" and every param after it is stranded alongside `dashboard` and `path`. A url that
 * arrived intact has nothing to restore and is returned untouched.
 *
 * :param path: The route as read from the launched url's `path` param.
 * :param search: The launched url's query string, as `window.location.search`.
 */
export function restoreStrayViewerParams(path: string, search: string): string {
  const stray = new URLSearchParams(search);
  const query = path.split("?")[1] ?? "";
  const present = new URLSearchParams(query);
  const additions: string[] = [];
  for (const key of VIEWER_ROUTE_PARAMS) {
    const value = stray.get(key);
    // never override what the route already carries: it is the authoritative copy
    if (value === null || present.has(key)) continue;
    additions.push(`${key}=${encodeURIComponent(value)}`);
  }
  if (additions.length === 0) return path;
  return `${path}${query ? "&" : "?"}${additions.join("&")}`;
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
