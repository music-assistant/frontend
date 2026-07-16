// shared logic to build the per-item context menu for the fullscreen queue list
import {
  gotoRadio,
  radioActionLabelKey,
  radioSupported,
} from "@/helpers/radio";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import api from "@/plugins/api";
import { MediaType, QueueItem } from "@/plugins/api/interfaces";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import { CassetteTape } from "@lucide/vue";

// Builds the context-menu entries for a single queue item. Items up to and
// including the buffered region are locked (already cued in the stream), so
// they can't be moved or removed.
export const getQueueItemMenuItems = (
  item: QueueItem,
  index: number,
): ContextMenuItem[] => {
  const queue = store.activePlayerQueue;
  if (!queue) return [];
  const queueId = queue.queue_id;
  const locked = index <= (queue.index_in_buffer ?? 0);

  const menuItems: ContextMenuItem[] = [
    {
      label: "play_now",
      labelArgs: [],
      action: () => api.queueCommandPlayIndex(queueId, item.queue_item_id),
      icon: "mdi-play-circle-outline",
      disabled:
        index === queue.current_index || index === queue.index_in_buffer,
    },
    {
      label: "play_next",
      labelArgs: [],
      action: () => api.queueCommandMoveNext(queueId, item.queue_item_id),
      icon: "mdi-skip-next-circle-outline",
      disabled: locked,
    },
  ];

  // go to this item's radio (a dynamic playlist generated from it as the seed)
  const mediaItem = item.media_item;
  if (mediaItem && radioSupported(mediaItem)) {
    menuItems.push({
      label: radioActionLabelKey(mediaItem),
      labelArgs: [],
      action: () => gotoRadio(mediaItem),
      icon: CassetteTape,
      disabled: false,
    });
  }

  // quick reorder / remove (drag the handle for fine-grained moves)
  menuItems.push(
    {
      label: "queue_move_end",
      labelArgs: [],
      action: () => api.queueCommandMoveItemEnd(queueId, item.queue_item_id),
      icon: "mdi-arrow-collapse-down",
      disabled: locked,
    },
    {
      label: "queue_delete",
      labelArgs: [],
      action: () => api.queueCommandDelete(queueId, item.queue_item_id),
      icon: "mdi-delete",
      disabled: locked,
    },
  );

  // tracks can be opened in their detail page (closes the fullscreen player)
  if (mediaItem?.media_type === MediaType.TRACK) {
    menuItems.push({
      label: "show_info",
      labelArgs: [],
      action: () => {
        store.showFullscreenPlayer = false;
        router.push({
          name: mediaItem.media_type,
          params: { itemId: mediaItem.item_id, provider: mediaItem.provider },
        });
      },
      icon: "mdi-information-outline",
      disabled: false,
    });
  }

  return menuItems;
};
