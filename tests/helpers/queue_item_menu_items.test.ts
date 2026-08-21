import { getQueueItemMenuItems } from "@/helpers/queue_item_menu_items";
import type { PlayerQueue } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";
import { queueItem } from "../fixtures/queueItem";

const { storeMock } = vi.hoisted(() => ({
  storeMock: {
    activePlayerQueue: undefined as PlayerQueue | undefined,
    showFullscreenPlayer: true,
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    queueCommandPlayIndex: vi.fn(),
    queueCommandMoveNext: vi.fn(),
    queueCommandMoveItemEnd: vi.fn(),
    queueCommandDelete: vi.fn(),
  },
}));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe("getQueueItemMenuItems", () => {
  beforeEach(() => {
    storeMock.activePlayerQueue = playerQueue({
      items: 5,
      current_index: 0,
      index_in_buffer: 1,
    });
  });

  it("offers the full action set on an MA-owned queue", () => {
    const items = getQueueItemMenuItems(queueItem(), 3);
    expect(labels(items)).toEqual([
      "play_now",
      "play_next",
      "queue_move_end",
      "queue_delete",
    ]);
  });

  it("withholds the move/remove actions on a session-owned queue", () => {
    storeMock.activePlayerQueue = playerQueue({
      items: 5,
      current_index: 0,
      index_in_buffer: 1,
      queue_owner: "spotify_connect--abc://audio_source/main",
    });
    const items = getQueueItemMenuItems(queueItem(), 3);
    expect(labels(items)).toEqual(["play_now"]);
  });
});
