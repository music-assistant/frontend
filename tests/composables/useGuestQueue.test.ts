import {
  EventType,
  PlaybackState,
  type EventMessage,
  type PlayerQueue,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { BEFORE_FIRST_INDEX } from "@/helpers/queue_position";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicAssistantApi } from "@/plugins/api";

const { mockSendCommand, mockGetPlayerQueueItems, mockSubscribe } = vi.hoisted(
  () => {
    return {
      mockSendCommand: vi.fn(),
      mockGetPlayerQueueItems:
        vi.fn<MusicAssistantApi["getPlayerQueueItems"]>(),
      mockSubscribe: vi.fn(),
    };
  },
);

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

// Import after mocks so that composable uses the mocked modules
import api from "@/plugins/api";
import { useGuestQueue } from "@/composables/guest/useGuestQueue";

describe("useGuestQueue", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockGetPlayerQueueItems.mockReset();
    mockSubscribe.mockReset();
    for (const key of Object.keys(api.queues)) delete api.queues[key];
  });

  it("fetches queue items for the party queue", async () => {
    const queue = {
      queue_id: "queue1",
      current_index: 5,
      items: 20,
    };
    const items = [queueItemFixture("item1"), queueItemFixture("item2")];

    mockSendCommand.mockResolvedValueOnce(queue);
    mockGetPlayerQueueItems.mockResolvedValueOnce(items);

    const {
      partyQueueId,
      queueItems,
      queueFetchOffset,
      queueTotalItems,
      fetchQueueItems,
    } = useGuestQueue();
    partyQueueId.value = "queue1";

    await fetchQueueItems(true);

    expect(mockSendCommand).toHaveBeenCalledWith("player_queues/get", {
      queue_id: "queue1",
    });
    expect(mockGetPlayerQueueItems).toHaveBeenCalledWith("queue1", 50, 0);

    expect(queueTotalItems.value).toBe(20);
    expect(queueFetchOffset.value).toBe(0);
    expect(queueItems.value).toEqual(items);
  });

  it("returns early when no party queue id is set", async () => {
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
    const initialItems = Array.from({ length: 50 }, (_, i) =>
      queueItemFixture(`item-${i}`),
    );
    const moreItems = Array.from({ length: 10 }, (_, i) =>
      queueItemFixture(`item-${50 + i}`),
    );

    mockSendCommand.mockResolvedValue(queue);
    mockGetPlayerQueueItems
      .mockResolvedValueOnce(initialItems)
      .mockResolvedValueOnce(moreItems);

    const {
      partyQueueId,
      queueItems,
      queueFetchOffset,
      queueTotalItems,
      fetchQueueItems,
      handleQueueScroll,
    } = useGuestQueue();
    partyQueueId.value = "queue1";

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

  it("exposes the party queue and its index from the same queue", () => {
    api.queues["party-player"] = {
      queue_id: "party-player",
      current_index: 3,
      state: PlaybackState.PLAYING,
    } as PlayerQueue;
    api.queues["queue1"] = {
      queue_id: "queue1",
      current_index: 7,
      state: PlaybackState.PAUSED,
    } as PlayerQueue;

    const { partyQueueId, currentQueue, currentQueueIndex } = useGuestQueue();
    partyQueueId.value = "party-player";

    expect(currentQueue.value?.queue_id).toBe("party-player");
    expect(currentQueue.value?.state).toBe(PlaybackState.PLAYING);
    expect(currentQueueIndex.value).toBe(3);
  });

  it("exposes no queue when no party queue id is set", () => {
    api.queues["queue1"] = {
      queue_id: "queue1",
      current_index: 7,
      state: PlaybackState.PAUSED,
    } as PlayerQueue;

    const { currentQueue, currentQueueIndex } = useGuestQueue();

    expect(currentQueue.value).toBeNull();
    expect(currentQueueIndex.value).toBe(BEFORE_FIRST_INDEX);
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

  it.each([
    ["QUEUE_ITEMS_UPDATED", 0],
    ["QUEUE_UPDATED", 1],
  ])("only refetches for %s events targeting the party queue", (_name, i) => {
    mockSubscribe.mockReturnValue(vi.fn());
    mockSendCommand.mockResolvedValue({
      queue_id: "party-player",
      current_index: 0,
      items: 1,
    });
    mockGetPlayerQueueItems.mockResolvedValue([queueItemFixture("item1")]);

    const { partyQueueId, subscribeToEvents } = useGuestQueue();
    subscribeToEvents();

    const handler = mockSubscribe.mock.calls[i][1] as (
      evt: EventMessage,
    ) => void;

    // Without a party queue id, an event carrying no object_id must not match either
    handler({ object_id: "other-queue" } as EventMessage);
    handler({} as EventMessage);
    expect(mockSendCommand).not.toHaveBeenCalled();

    partyQueueId.value = "party-player";

    handler({ object_id: "other-queue" } as EventMessage);
    expect(mockSendCommand).not.toHaveBeenCalled();

    handler({ object_id: "party-player" } as EventMessage);
    expect(mockSendCommand).toHaveBeenCalledWith("player_queues/get", {
      queue_id: "party-player",
    });
  });
});

function queueItemFixture(queueItemId: string): QueueItem {
  return {
    queue_id: "queue1",
    queue_item_id: queueItemId,
    name: queueItemId,
    duration: 200,
    sort_index: 0,
    streamdetails: null,
    media_item: null,
    image: null,
    available: true,
  };
}
