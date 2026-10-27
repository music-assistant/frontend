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
 * Keep the played state of the listed collections current when one of their
 * audiobooks is played; the server computes it over all items.
 */
export function useCollectionMetadata(items: () => MediaItemType[]) {
  const unsubscribe = api.subscribe_multi(
    [EventType.MEDIA_ITEM_PLAYED, EventType.PLAYLOG_UPDATED],
    (evt: EventMessage) => {
      // a playback report carries the same fields as a playlog update
      const update = evt.data as PlaylogUpdate | undefined;
      if (update?.media_type !== MediaType.AUDIOBOOK) return;
      // per-user playlog: ignore changes belonging to another user (null = everyone)
      if (update.userid && update.userid !== store.currentUser?.user_id) return;
      const inProgress = !update.fully_played && update.seconds_played > 0;
      for (const collection of items()) {
        if (
          collection.media_type !== MediaType.COLLECTION ||
          !("items" in collection) ||
          !collection.items.some((item) => item.uri === update.uri)
        )
          continue;
        // one book in progress settles it, so a report during playback needs no request
        if (inProgress) {
          Object.assign(collection.metadata, {
            fully_played: false,
            in_progress: true,
          });
          continue;
        }
        // a finished or reset book depends on the others, once it is stored
        if (evt.event !== EventType.PLAYLOG_UPDATED) continue;
        // only the played state: count, duration and covers keep the listing's scope;
        // the catch below is the one error toast
        api
          .getAudiobookCollection(
            collection.item_id,
            undefined,
            1,
            undefined,
            undefined,
            { suppressGlobalError: true },
          )
          .then(({ metadata: { fully_played, in_progress } }) => {
            Object.assign(collection.metadata, { fully_played, in_progress });
          })
          .catch(() => toast.error($t("collection_refresh_failed")));
      }
    },
  );
  onScopeDispose(unsubscribe);
}
