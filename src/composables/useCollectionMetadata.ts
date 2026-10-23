import { api } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type EventMessage,
  type MediaItemType,
  type PlaylogUpdate,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { onScopeDispose } from "vue";
import { toast } from "vue-sonner";

/**
 * Keep the metadata of the listed collections current when the played state
 * of one of their audiobooks changes; the server computes it over all items.
 */
export function useCollectionMetadata(items: () => MediaItemType[]) {
  const unsubscribe = api.subscribe(
    EventType.PLAYLOG_UPDATED,
    (evt: EventMessage) => {
      const update = evt.data as PlaylogUpdate | undefined;
      if (update?.media_type !== MediaType.AUDIOBOOK) return;
      // per-user playlog: ignore changes belonging to another user (null = everyone)
      if (update.userid && update.userid !== store.currentUser?.user_id) return;
      for (const collection of items()) {
        if (
          collection.media_type !== MediaType.COLLECTION ||
          !("items" in collection) ||
          !collection.items.some((item) => item.uri === update.uri)
        )
          continue;
        // one book in progress settles it; playback reports this every 30 seconds
        if (!update.fully_played && update.seconds_played > 0) {
          Object.assign(collection.metadata, {
            fully_played: false,
            in_progress: true,
          });
          continue;
        }
        // a finished or reset book depends on the others: a single item suffices,
        // the metadata covers all of them
        api
          .getAudiobookCollection(collection.item_id, undefined, 1)
          .then(({ metadata }) => {
            collection.metadata = metadata;
          })
          .catch(() => toast.error($t("collection_refresh_failed")));
      }
    },
  );
  onScopeDispose(unsubscribe);
}
