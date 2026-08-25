// shared navigation for the item the active player is playing, so the player
// bar and the full screen player land in the same place
import { useCommandCenter } from "@/composables/useCommandCenter";
import api from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const { open: openCommandCenter } = useCommandCenter();

/**
 * Opens the detail page of the track that is playing.
 *
 * A track the library does not hold - a radio stream, or a provider item played
 * straight through - is looked up by name first, and falls back to the command
 * center when the library has nothing matching it.
 */
export const openCurrentTrackDetails = async function () {
  const currentMedia = store.activePlayer?.current_media;
  if (!currentMedia) return;

  // Try to get the track from the full media item (for library items)
  const mediaItem = store.curQueueItem?.media_item;

  if (mediaItem && mediaItem.media_type === MediaType.TRACK) {
    // Navigate directly to track detail page
    store.showFullscreenPlayer = false;
    router.push({
      name: "track",
      params: {
        itemId: mediaItem.item_id,
        provider: mediaItem.provider,
      },
    });
    return;
  }

  // Radio or non-library item - try to find in library first
  const searchTerm = currentMedia.artist
    ? `${currentMedia.artist} - ${currentMedia.title}`
    : currentMedia.title || "";

  try {
    // Call with positional parameters: (favorite, search, limit, offset, order_by, provider)
    const results = await api.getLibraryTracks(
      undefined, // favorite
      searchTerm, // search
      5, // limit - get a few results to find best match
      undefined,
      undefined,
      undefined,
      undefined, // genre_ids
    );

    if (results.length > 0) {
      // Try to find best match by comparing artist and title
      let bestMatch = results[0];

      if (currentMedia.artist && currentMedia.title) {
        const exactMatch = results.find(
          (track) =>
            track.name.toLowerCase() === currentMedia.title!.toLowerCase() &&
            track.artists.some(
              (artist) =>
                artist.name.toLowerCase() ===
                currentMedia.artist!.toLowerCase(),
            ),
        );
        if (exactMatch) {
          bestMatch = exactMatch;
        }
      }

      // Found in library! Navigate to it
      store.showFullscreenPlayer = false;
      router.push({
        name: "track",
        params: {
          itemId: bestMatch.item_id,
          provider: bestMatch.provider,
        },
      });
      return;
    }
  } catch (error) {
    console.error("Error searching library for track:", error);
  }

  // Not found in library - hand the term to the command center
  store.showFullscreenPlayer = false;
  openCommandCenter({ query: searchTerm });
};
