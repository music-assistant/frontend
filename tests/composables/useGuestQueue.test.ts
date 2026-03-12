import { EventType, type PlayerQueue } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendCommand, mockGetPlayerQueueItems, mockSubscribe, storeMock } =
  vi.hoisted(() => {
    return {
      mockSendCommand: vi.fn(),
      mockGetPlayerQueueItems: vi.fn(),
      mockSubscribe: vi.fn(),
      storeMock: {
        activePlayerQueue: { queue_id: "queue1" } as {
          queue_id: string;
        } | null,
      },
    };
  });

vi.mock("@/plugins/api", () => {
  return {
    default: {
      queues: {} as Record<string, PlayerQueue>,
      sendCommand: mockSendCommand,
      getPlayerQueueItems: mockGetPlayerQueueItems,
      subscribe: mockSubscribe,
    },
  };
});

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

// Import after mocks so that composable uses the mocked modules
import { useGuestQueue } from "@/composables/useGuestQueue";

describe("useGuestQueue", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockGetPlayerQueueItems.mockReset();
    mockSubscribe.mockReset();
    storeMock.activePlayerQueue = { queue_id: "queue1" };
  });

  it("fetches queue items using active player queue when no party queue id is set", async () => {
    const queue = {
      queue_id: "queue1",
      current_index: 5,
      items: 20,
    };
    const items = [{ queue_item_id: "item1" }, { queue_item_id: "item2" }];

    mockSendCommand.mockResolvedValueOnce(queue);
    mockGetPlayerQueueItems.mockResolvedValueOnce(items);

    const { queueItems, queueFetchOffset, queueTotalItems, fetchQueueItems } =
      useGuestQueue();

    await fetchQueueItems(true);

    expect(mockSendCommand).toHaveBeenCalledWith("player_queues/get", {
      queue_id: "queue1",
    });
    expect(mockGetPlayerQueueItems).toHaveBeenCalledWith("queue1", 50, 0);

    expect(queueTotalItems.value).toBe(20);
    expect(queueFetchOffset.value).toBe(0);
    expect(queueItems.value).toEqual(items);
  });

  it("returns early when no active queue id is available", async () => {
    storeMock.activePlayerQueue = null;
    const { queueItems, fetchQueueItems } = useGuestQueue();

    await fetchQueueItems(true);

    expect(queueItems.value).toEqual([]);
    expect(mockSendCommand).not.toHaveBeenCalled();
    expect(mockGetPlayerQueueItems).not.toHaveBeenCalled();
  });

  it("loads more items when scrolling near the bottom and more items are available", async () => {
    const queue = {
      queue_id: "queue1",
      current_index: 0,
      items: 100,
    };
    const initialItems = Array.from({ length: 50 }, (_, i) => ({
      queue_item_id: `item-${i}`,
    }));
    const moreItems = Array.from({ length: 10 }, (_, i) => ({
      queue_item_id: `item-${50 + i}`,
    }));

    mockSendCommand.mockResolvedValue(queue);
    mockGetPlayerQueueItems
      .mockResolvedValueOnce(initialItems)
      .mockResolvedValueOnce(moreItems);

    const {
      queueItems,
      queueFetchOffset,
      queueTotalItems,
      fetchQueueItems,
      handleQueueScroll,
    } = useGuestQueue();

    await fetchQueueItems(true);

    expect(queueItems.value).toHaveLength(50);
    expect(queueTotalItems.value).toBe(100);

    const target = {
      scrollTop: 900,
      clientHeight: 100,
      scrollHeight: 1000,
    } as unknown as HTMLElement;

    const event = { target } as unknown as Event;
    handleQueueScroll(event);

    expect(mockGetPlayerQueueItems).toHaveBeenLastCalledWith("queue1", 50, 0);
    expect(queueFetchOffset.value).toBe(0);
  });

  it("subscribes to queue events and returns a cleanup function", () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();

    mockSubscribe.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    const { subscribeToEvents } = useGuestQueue();

    const cleanup = subscribeToEvents();

    expect(mockSubscribe).toHaveBeenCalledTimes(2);
    expect(mockSubscribe).toHaveBeenNthCalledWith(
      1,
      EventType.QUEUE_ITEMS_UPDATED,
      expect.any(Function),
    );
    expect(mockSubscribe).toHaveBeenNthCalledWith(
      2,
      EventType.QUEUE_UPDATED,
      expect.any(Function),
    );

    cleanup();

    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(unsub2).toHaveBeenCalledTimes(1);
  });
});
