import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import { errorMessage } from "@/helpers/ai_radio";
import api, { ConnectionState } from "@/plugins/api";
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
 * it plays; undefined when that item has no bookmarks, no copy chosen yet, no
 * known position yet
 */
export function newBookmarkOfPlayingItem(): NewBookmark | undefined {
  const queueItem = store.curQueueItem;
  const media = queueItem?.media_item;
  const streamdetails = queueItem?.streamdetails;
  const elapsed = resolveActiveElapsedTime();
  if (
    !media ||
    !(media.media_type in BOOKMARK_EDIT_FEATURES) ||
    !streamdetails ||
    elapsed === undefined ||
    !authManager.hasScope(Scope.LIBRARY_WRITE)
  ) {
    return undefined;
  }
  // a copy whose bookmarks no store takes is refused by the server, which says why
  const providerKeepsThem = providerEditsBookmarks(
    streamdetails.provider,
    media.media_type,
  );
  return {
    mediaType: media.media_type,
    providerInstanceId: streamdetails.provider,
    providerItemId: streamdetails.item_id,
    storedIn: bookmarkStoreName(streamdetails.provider, !providerKeepsThem),
    // whole seconds, as the Audiobookshelf web client sets them
    start: Math.floor(elapsed),
  };
}

/** Save a new bookmark under the name, with a toast either way. */
export async function saveNewBookmark(bookmark: NewBookmark, name: string) {
  try {
    await api.setBookmark(
      bookmark.mediaType,
      bookmark.providerInstanceId,
      bookmark.providerItemId,
      bookmark.start,
      name,
    );
    toast.success($t("bookmark_added"));
  } catch (error) {
    // e.g. a shared account only its owner may write to: the server says why
    toast.error($t("bookmark_add_failed"), {
      description: errorMessage(error),
    });
  }
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
  // only the latest load applies, so an older answer cannot undo a newer one
  let generation = 0;

  const load = async function () {
    const current = ++generation;
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
    if (current === generation) bookmarks.value = loaded;
  };

  watch(
    () => wanted.value && [wanted.value.uri, ...wanted.value.copyUris].join(),
    () => {
      bookmarks.value = [];
      load();
    },
    { immediate: true },
  );

  // changes made while the connection was down arrive with the next sync
  watch(
    () => api.state?.value,
    (state, previous) => {
      if (state === ConnectionState.INITIALIZED && previous !== state) load();
    },
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
  // the type when the dialog opened: the playing item may change while it is open
  let renamedType: MediaType | undefined;

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
    renamedType = mediaType();
    renameDialogOpen.value = true;
  };

  const renameSaved = async function (name: string) {
    const bookmark = renamedBookmark.value;
    const type = renamedType;
    if (!bookmark || !type) return;
    try {
      await api.setBookmark(
        type,
        bookmark.provider_instance,
        bookmark.item_id,
        bookmark.start,
        name,
      );
      toast.success($t("bookmark_renamed"));
    } catch (error) {
      toast.error($t("bookmark_rename_failed"), {
        description: errorMessage(error),
      });
    }
  };

  const removeClicked = function (bookmark: MediaItemBookmark) {
    const type = mediaType();
    if (!type) return;
    eventbus.emit("deleteConfirmationDialog", {
      title: $t("delete_bookmark"),
      message: $t("delete_bookmark_confirm", { name: bookmark.name }),
      confirmLabel: $t("delete"),
      onConfirm: async () => {
        try {
          await api.removeBookmark(
            type,
            bookmark.provider_instance,
            bookmark.item_id,
            bookmark.start,
          );
          toast.success($t("bookmark_deleted"));
        } catch (error) {
          toast.error($t("bookmark_delete_failed"), {
            description: errorMessage(error),
          });
        }
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
