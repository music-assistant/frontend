import {
  BEFORE_FIRST_INDEX,
  currentQueueIndex,
  isQueueEnded,
} from "@/helpers/queue_position";
import { type PlayerQueue } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";

function makeQueue(overrides: Partial<PlayerQueue> = {}): PlayerQueue {
  return {
    queue_id: "queue-1",
    active: true,
    display_name: "Queue",
    available: true,
    items: 5,
    ended: false,
    ...overrides,
  } as PlayerQueue;
}

describe("currentQueueIndex", () => {
  it("returns the queue's own index while it is playing", () => {
    expect(currentQueueIndex(makeQueue({ current_index: 2 }))).toBe(2);
  });

  it("sits before the first item for a queue that never started", () => {
    // coalescing to 0 here is what made track 1 look like it was playing
    expect(currentQueueIndex(makeQueue())).toBe(BEFORE_FIRST_INDEX);
    expect(BEFORE_FIRST_INDEX).toBeLessThan(0);
  });

  it("sits past the last item for a queue that ended", () => {
    // the position is still on the last item, but no row is current anymore
    const queue = makeQueue({ ended: true, current_index: 4, items: 5 });
    expect(currentQueueIndex(queue)).toBe(5);
  });

  it("sits before the first item when there is no queue at all", () => {
    expect(currentQueueIndex(undefined)).toBe(BEFORE_FIRST_INDEX);
    expect(currentQueueIndex(null)).toBe(BEFORE_FIRST_INDEX);
  });
});

describe("isQueueEnded", () => {
  it("is true for a queue that played through and kept its items", () => {
    expect(isQueueEnded(makeQueue({ ended: true, current_index: 4 }))).toBe(
      true,
    );
  });

  it("is false while the queue is still playing", () => {
    expect(isQueueEnded(makeQueue({ current_index: 2 }))).toBe(false);
  });

  it("is false for an emptied queue, which has nothing to start over", () => {
    expect(isQueueEnded(makeQueue({ ended: true, items: 0 }))).toBe(false);
  });

  it("is false when there is no queue at all", () => {
    expect(isQueueEnded(undefined)).toBe(false);
  });
});
