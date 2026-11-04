import { getQueueItemMenuItems } from "@/helpers/queue_item_menu_items";
import type { PlayerQueue } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";
import { queueItem } from "../fixtures/queueItem";
import { track } from "../fixtures/track";

const { storeMock, hasScope, getItemShareInfo } = vi.hoisted(() => ({
  hasScope: vi.fn(() => false),
  getItemShareInfo: vi.fn(),
  storeMock: {
    activePlayerQueue: undefined as PlayerQueue | undefined,
    showFullscreenPlayer: true,
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    providers: {},
    state: { value: "initialized" },
    getItemShareInfo,
    queueCommandPlayIndex: vi.fn(),
    queueCommandMoveNext: vi.fn(),
    queueCommandMoveItemEnd: vi.fn(),
    queueCommandDelete: vi.fn(),
  },
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe("getQueueItemMenuItems", () => {
  beforeEach(() => {
    hasScope.mockReturnValue(false);
    getItemShareInfo.mockReset();
    storeMock.activePlayerQueue = playerQueue({
      items: 5,
      current_index: 0,
      index_in_buffer: 1,
    });
  });

  it("prepares sharing with the catalog identity instead of the queue URI", async () => {
    hasScope.mockReturnValue(true);
    getItemShareInfo.mockResolvedValue({
      title: "Song",
      text: "Song",
      links: [],
    });
    const mediaItem = track();
    const item = queueItem({ media_item: mediaItem });
    const menu = getQueueItemMenuItems(item, 3);
    const share = menu.find((entry) => entry.label === "provider_links.share");
    expect(share).toBeDefined();
    expect(getItemShareInfo).not.toHaveBeenCalled();
    await share!.prepare!();
    expect(getItemShareInfo).toHaveBeenCalledWith(mediaItem.uri);
  });

  it("offers the full action set on an up-next item", () => {
    const items = getQueueItemMenuItems(queueItem(), 3);
    expect(labels(items)).toEqual([
      "play_now",
      "play_next",
      "queue_move_end",
      "queue_delete",
    ]);
  });

  it("adds show info for track items", () => {
    const items = getQueueItemMenuItems(queueItem({ media_item: track() }), 3);
    expect(labels(items)).toEqual([
      "play_now",
      "play_next",
      "queue_move_end",
      "queue_delete",
      "show_info",
    ]);
  });
});
