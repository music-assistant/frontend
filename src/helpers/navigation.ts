import type { Router } from "vue-router";

/**
 * Whether there is an earlier in-app view to return to.
 *
 * False when the current view was opened directly - a deep link, a reload or
 * a fresh tab - where going back would leave the app.
 */
export function canGoBack(router: Router): boolean {
  return router.options.history.state.back != null;
}

/**
 * Leaves a media details view, back to where the user came from or, when the
 * details view was opened directly, up to the library listing it belongs to.
 */
export function backFromMediaDetails(router: Router): void {
  if (canGoBack(router)) {
    router.back();
    return;
  }
  const routeName = router.currentRoute.value.name?.toString() ?? "";
  router.push({ name: LISTING_ROUTES[routeName] ?? "discover" });
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
