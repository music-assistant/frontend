// Dashboard routes a cast viewer session may be pinned to. Anything else
// falls back to the party dashboard.
const CAST_VIEWER_ROUTES = new Set(["/party", "/music-quiz"]);

export function sanitizeCastViewerPath(path: string | null): string {
  return path && CAST_VIEWER_ROUTES.has(path) ? path : "/party";
}

export function getCastViewerNavigationRedirect(
  isCastViewer: boolean,
  pinnedPath: string | null,
  path: string,
): string | undefined {
  if (isCastViewer && pinnedPath && path !== pinnedPath) {
    return pinnedPath;
  }
  return undefined;
}
