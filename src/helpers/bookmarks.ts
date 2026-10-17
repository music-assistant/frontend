import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import api from "@/plugins/api";
import { MediaType, ProviderFeature, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";

// the provider features to read and to edit bookmarks, per media type that has them
export const BOOKMARK_FEATURES: Partial<
  Record<MediaType, { read: ProviderFeature; edit: ProviderFeature }>
> = {
  [MediaType.AUDIOBOOK]: {
    read: ProviderFeature.AUDIOBOOK_BOOKMARKS,
    edit: ProviderFeature.AUDIOBOOK_BOOKMARKS_EDIT,
  },
  [MediaType.PODCAST_EPISODE]: {
    read: ProviderFeature.PODCAST_EPISODE_BOOKMARKS,
    edit: ProviderFeature.PODCAST_EPISODE_BOOKMARKS_EDIT,
  },
};

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
  const features = media && BOOKMARK_FEATURES[media.media_type];
  if (
    !media ||
    !features ||
    !streamdetails ||
    !authManager.hasScope(Scope.LIBRARY_WRITE)
  ) {
    return undefined;
  }
  const provider = api.providers[streamdetails.provider];
  return {
    mediaType: media.media_type,
    providerInstanceId: streamdetails.provider,
    providerItemId: streamdetails.item_id,
    storedIn: provider?.supported_features.includes(features.edit)
      ? provider.name
      : "Music Assistant",
    // whole seconds, as the Audiobookshelf web client sets them
    start: Math.floor(resolveActiveElapsedTime() ?? 0),
  };
}
