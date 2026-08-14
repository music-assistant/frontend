import type { RouteLocationRaw, Router } from "vue-router";

/**
 * Whether there is an earlier in-app view to return to.
 *
 * False only on the view a session started at, reached by a deep link or in a
 * fresh tab. History state outlives a reload, so anything navigated to inside
 * the app keeps its way back.
 */
export function canGoBack(router: Router): boolean {
  return router.options.history.state.back != null;
}

/**
 * Returns to the previous view, or goes to `fallback` when the current view
 * was opened directly and a plain back would strand the user where they are.
 */
export function goBack(router: Router, fallback: RouteLocationRaw): void {
  if (canGoBack(router)) {
    router.back();
    return;
  }
  router.push(fallback);
}

/**
 * Leaves a media details view, back to where the user came from or, when the
 * details view was opened directly, up to the library listing it belongs to.
 */
export function backFromMediaDetails(router: Router): void {
  const routeName = router.currentRoute.value.name?.toString() ?? "";
  goBack(router, { name: LISTING_ROUTES[routeName] ?? "discover" });
}

// Details route name -> the library listing it sits under. Collections are
// browsed from the audiobooks listing, which is where their route nests too.
const LISTING_ROUTES: Record<string, string | undefined> = {
  album: "albums",
  artist: "artists",
  audiobook: "audiobooks",
  collection: "audiobooks",
  genre: "genres",
  playlist: "playlists",
  podcast: "podcasts",
  radio: "radios",
  track: "tracks",
};
