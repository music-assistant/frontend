import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import api from "@/plugins/api";
import { MediaType, ProviderFeature, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";

// the provider feature to edit bookmarks, per media type that has bookmarks
export const BOOKMARK_EDIT_FEATURES: Partial<
  Record<MediaType, ProviderFeature>
> = {
  [MediaType.AUDIOBOOK]: ProviderFeature.AUDIOBOOK_BOOKMARKS_EDIT,
  [MediaType.PODCAST_EPISODE]: ProviderFeature.PODCAST_EPISODE_BOOKMARKS_EDIT,
};

// whether the provider keeps bookmarks of the media type itself
export function providerEditsBookmarks(
  providerInstanceId: string,
  mediaType: MediaType,
): boolean {
  const feature = BOOKMARK_EDIT_FEATURES[mediaType];
  return (
    !!feature &&
    (api.providers[providerInstanceId]?.supported_features.includes(feature) ??
      false)
  );
}

export interface NewBookmark {
  mediaType: MediaType;
  providerInstanceId: string;
  providerItemId: string;
  // the provider, or Music Assistant, that keeps the bookmark
  storedIn: string;
  start: number;
}

/**
 * A bookmark at the current position of the active player's item, on the copy
 * it plays; undefined when that item has no bookmarks or no copy chosen yet
 */
export function newBookmarkOfPlayingItem(): NewBookmark | undefined {
  const queueItem = store.curQueueItem;
  const media = queueItem?.media_item;
  const streamdetails = queueItem?.streamdetails;
  if (
    !media ||
    !(media.media_type in BOOKMARK_EDIT_FEATURES) ||
    !streamdetails ||
    !authManager.hasScope(Scope.LIBRARY_WRITE)
  ) {
    return undefined;
  }
  return {
    mediaType: media.media_type,
    providerInstanceId: streamdetails.provider,
    providerItemId: streamdetails.item_id,
    storedIn: providerEditsBookmarks(streamdetails.provider, media.media_type)
      ? api.providers[streamdetails.provider].name
      : "Music Assistant",
    // whole seconds, as the Audiobookshelf web client sets them
    start: Math.floor(resolveActiveElapsedTime() ?? 0),
  };
}
