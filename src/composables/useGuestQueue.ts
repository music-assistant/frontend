/**
 * Guest queue composable for managing queue state, fetching,
 * windowed pagination, auto-scroll, and event subscriptions.
 */

import { ref, computed, watch, nextTick } from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import type { PlayerQueue, QueueItem } from "@/plugins/api/interfaces";
import { EventType, type EventMessage } from "@/plugins/api/interfaces";

export function useGuestQueue(options?: {
  onItemsChanged?: () => void;
}) {
  const queueItems = ref<QueueItem[]>([]);
  const partyModeQueueId = ref<string | null>(null);
  const queueListRef = ref<HTMLElement | null>(null);
  const queueFetchOffset = ref(0);
  const queueTotalItems = ref(0);
  const loadingMoreQueueItems = ref(false);

  const currentQueue = computed(() => {
    const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
    return queueId ? api.queues[queueId] : null;
  });

  const currentQueueIndex = computed(
    () => currentQueue.value?.current_index ?? 0,
  );

  const scrollToCurrentItem = async () => {
    await nextTick();
    if (!queueListRef.value) return;

    const activeItem = queueListRef.value.querySelector(
      ".queue-item-current",
    ) as HTMLElement;
    if (activeItem) {
      const container = queueListRef.value;
      const containerRect = container.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      const relativeTop = itemRect.top - containerRect.top + container.scrollTop;

      container.scrollTo({ top: relativeTop, behavior: "smooth" });
    }
  };

  // Auto-scroll to currently playing item when it changes
  watch(currentQueueIndex, scrollToCurrentItem);

  // Scroll when queue items are loaded (but not when appending more items)
  watch(
    queueItems,
    async (newItems, oldItems) => {
      if (newItems.length > 0) {
        const isAppending =
          oldItems &&
          oldItems.length > 0 &&
          newItems.length > oldItems.length &&
          newItems
            .slice(0, oldItems.length)
            .every((item, i) => item.queue_item_id === oldItems[i].queue_item_id);

        if (!isAppending) {
          scrollToCurrentItem();
        }
        options?.onItemsChanged?.();
      }
    },
    { deep: true },
  );

  const fetchQueueItems = async (reset = true) => {
    const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
    if (!queueId) {
      queueItems.value = [];
      return;
    }

    try {
      const queue = await api.sendCommand<PlayerQueue>("player_queues/get", {
        queue_id: queueId,
      });
      if (queue) {
        api.queues[queueId] = queue;
        queueTotalItems.value = queue.items || 0;
      }

      if (reset) {
        const currentIdx = queue?.current_index ?? 0;
        const offset = Math.max(0, currentIdx - 10);
        queueFetchOffset.value = offset;

        const items = await api.getPlayerQueueItems(queueId, 50, offset);
        queueItems.value = items;
      } else {
        loadingMoreQueueItems.value = true;
        const newOffset = queueFetchOffset.value + queueItems.value.length;

        if (newOffset < queueTotalItems.value) {
          const items = await api.getPlayerQueueItems(queueId, 50, newOffset);
          queueItems.value = [...queueItems.value, ...items];
        }

        loadingMoreQueueItems.value = false;
      }
    } catch (error) {
      console.error("Failed to fetch queue items:", error);
      loadingMoreQueueItems.value = false;
    }
  };

  const handleQueueScroll = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target || loadingMoreQueueItems.value) return;

    const scrollPosition = target.scrollTop + target.clientHeight;
    const scrollHeight = target.scrollHeight;
    const threshold = 100;

    const hasMore =
      queueFetchOffset.value + queueItems.value.length < queueTotalItems.value;
    if (scrollPosition >= scrollHeight - threshold && hasMore) {
      fetchQueueItems(false);
    }
  };

  /**
   * Subscribe to queue events. Returns a cleanup function.
   */
  const subscribeToEvents = (): (() => void) => {
    const unsub1 = api.subscribe(
      EventType.QUEUE_ITEMS_UPDATED,
      (evt: EventMessage) => {
        const queueId =
          partyModeQueueId.value || store.activePlayerQueue?.queue_id;
        if (evt.object_id === queueId) {
          fetchQueueItems(true);
        }
      },
    );

    const unsub2 = api.subscribe(EventType.QUEUE_UPDATED, (evt: EventMessage) => {
      const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
      if (evt.object_id === queueId) {
        const currentIdx = currentQueueIndex.value;
        const fetchedStart = queueFetchOffset.value;
        const fetchedEnd = fetchedStart + queueItems.value.length;

        if (
          currentIdx < fetchedStart + 5 ||
          currentIdx > fetchedEnd - 5 ||
          queueItems.value.length === 0
        ) {
          fetchQueueItems(true);
        }
      }
    });

    return () => {
      unsub1();
      unsub2();
    };
  };

  return {
    queueItems,
    queueListRef,
    queueFetchOffset,
    queueTotalItems,
    loadingMoreQueueItems,
    partyModeQueueId,
    currentQueue,
    currentQueueIndex,
    fetchQueueItems,
    handleQueueScroll,
    scrollToCurrentItem,
    subscribeToEvents,
  };
}
