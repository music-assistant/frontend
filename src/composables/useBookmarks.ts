import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import api from "@/plugins/api";
import {
  EventType,
  MediaType,
  ProviderFeature,
  Scope,
  type EventMessage,
  type MediaItemBookmark,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { toast } from "vue-sonner";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

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

// the provider, or Music Assistant, that keeps bookmarks of the copy
export function bookmarkStoreName(
  providerInstanceId: string,
  storedByMusicAssistant: boolean,
): string {
  return storedByMusicAssistant
    ? "Music Assistant"
    : (api.providers[providerInstanceId]?.name ?? providerInstanceId);
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
    storedIn: bookmarkStoreName(
      streamdetails.provider,
      !providerEditsBookmarks(streamdetails.provider, media.media_type),
    ),
    // whole seconds, as the Audiobookshelf web client sets them
    start: Math.floor(resolveActiveElapsedTime() ?? 0),
  };
}

export interface BookmarkedItem {
  mediaType: MediaType;
  itemId: string;
  provider: string;
  uri: string;
  // the copies whose changes reload the bookmarks
  copyUris: string[];
}

/**
 * The user's bookmarks of the item, undefined for none, kept current with the
 * server's changes.
 */
export function useBookmarks(item: () => BookmarkedItem | undefined) {
  const bookmarks = ref<MediaItemBookmark[]>([]);
  const wanted = computed(item);

  const load = async function () {
    const requested = wanted.value;
    if (!requested) {
      bookmarks.value = [];
      return;
    }
    const loaded = await api.getBookmarks(
      requested.mediaType,
      requested.itemId,
      requested.provider,
    );
    // stepping to another item while this was in flight leaves it for that item's load
    if (wanted.value?.uri === requested.uri) bookmarks.value = loaded;
  };

  watch(
    () => wanted.value && [wanted.value.uri, ...wanted.value.copyUris].join(),
    () => {
      bookmarks.value = [];
      load();
    },
    { immediate: true },
  );

  // a change made here, in the player or on another device
  onMounted(() => {
    const unsub = api.subscribe(
      EventType.BOOKMARKS_UPDATED,
      (evt: EventMessage) => {
        if (evt.object_id && wanted.value?.copyUris.includes(evt.object_id)) {
          load();
        }
      },
    );
    onBeforeUnmount(unsub);
  });

  return { bookmarks };
}

/**
 * Renaming and deleting the user's bookmarks of an item of the media type: a
 * rename goes through a dialog, a delete through the confirmation dialog.
 */
export function useBookmarkActions(mediaType: () => MediaType | undefined) {
  const renameDialogOpen = ref(false);
  const renamedBookmark = ref<MediaItemBookmark>();

  // where somebody can make edits, on a copy that takes them
  const isEditable = function (bookmark: MediaItemBookmark) {
    const type = mediaType();
    return (
      !!type &&
      authManager.hasScope(Scope.LIBRARY_WRITE) &&
      (bookmark.stored_by_music_assistant ||
        providerEditsBookmarks(bookmark.provider_instance, type))
    );
  };

  const storeName = (bookmark: MediaItemBookmark) =>
    bookmarkStoreName(
      bookmark.provider_instance,
      bookmark.stored_by_music_assistant,
    );

  const renameClicked = function (bookmark: MediaItemBookmark) {
    renamedBookmark.value = bookmark;
    renameDialogOpen.value = true;
  };

  const renameSaved = async function (name: string) {
    const bookmark = renamedBookmark.value;
    const type = mediaType();
    if (!bookmark || !type) return;
    await api.setBookmark(
      type,
      bookmark.provider_instance,
      bookmark.item_id,
      bookmark.start,
      name,
    );
    toast.success($t("bookmark_renamed"));
  };

  const removeClicked = function (bookmark: MediaItemBookmark) {
    const type = mediaType();
    if (!type) return;
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("delete_bookmark"),
      message: $t("delete_bookmark_confirm", { name: bookmark.name }),
      confirmLabel: $t("delete"),
      onConfirm: async () => {
        await api.removeBookmark(
          type,
          bookmark.provider_instance,
          bookmark.item_id,
          bookmark.start,
        );
        toast.success($t("bookmark_deleted"));
      },
    });
  };

  return {
    renameDialogOpen,
    renamedBookmark,
    isEditable,
    storeName,
    renameClicked,
    renameSaved,
    removeClicked,
  };
}
