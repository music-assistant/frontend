import type { ItemsListingPreferences } from "@/composables/userPreferences";
import { LEGACY_COMPACT_VIEW_MODE } from "@/helpers/grid_size";

export const GENRE_VIEW_PREFERENCE = "genre_detail_view";

// genre page sections have no listing path of their own
export const GENRE_SECTION_ITEMTYPES = [
  "artists",
  "albums",
  "tracks",
  "playlists",
  "podcasts",
  "audiobooks",
] as const;

/** Save a genre view; a legacy compact view also hides the sections' actions. */
export function applyGenreView(
  prefs: Record<string, unknown>,
  view: string,
): Record<string, unknown> {
  const updated: Record<string, unknown> = {
    ...prefs,
    [GENRE_VIEW_PREFERENCE]: view,
  };
  if (prefs[GENRE_VIEW_PREFERENCE] !== LEGACY_COMPACT_VIEW_MODE) return updated;
  for (const itemtype of GENRE_SECTION_ITEMTYPES) {
    const key = `itemsListing.${itemtype}.${itemtype}`;
    const listing = (prefs[key] as ItemsListingPreferences | undefined) ?? {};
    updated[key] = { ...listing, showActions: listing.showActions ?? false };
  }
  return updated;
}
