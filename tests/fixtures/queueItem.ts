import type { QueueItem } from "@/plugins/api/interfaces";

/**
 * A complete queue item, for tests that only care about a few of its fields but
 * should still model a payload the server can send.
 */
export function queueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    queue_id: "queue-1",
    queue_item_id: "item-1",
    name: "Queue item",
    duration: 200,
    sort_index: 0,
    streamdetails: null,
    media_item: null,
    image: null,
    available: true,
    ...overrides,
  };
}
