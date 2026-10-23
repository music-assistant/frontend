import type { Artist, ItemMapping } from "@/plugins/api/interfaces";

/**
 * The artists that appear most across these items, most items first; artists
 * on as many items keep the order they first appear in. Items without artists,
 * such as radio stations, are skipped.
 */
export function rankFeaturedArtists(
  tracks: readonly object[],
  limit: number,
): Array<Artist | ItemMapping> {
  const counts = new Map<
    string,
    { artist: Artist | ItemMapping; count: number }
  >();
  for (const track of tracks) {
    const artists: Array<Artist | ItemMapping> =
      "artists" in track && Array.isArray(track.artists) ? track.artists : [];
    for (const artist of artists) {
      const entry = counts.get(artist.uri);
      if (entry) entry.count++;
      else counts.set(artist.uri, { artist, count: 1 });
    }
  }
  // Map keeps insertion order and the sort is stable, so ties stay in order
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.artist);
}
