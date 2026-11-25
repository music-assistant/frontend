import { getQueueItemMenuItems } from "@/helpers/queue_item_menu_items";
import type { PlayerQueue } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";
import { providerMapping } from "../fixtures/providerMapping";
import { queueItem } from "../fixtures/queueItem";
import { track } from "../fixtures/track";

const { storeMock } = vi.hoisted(() => ({
  storeMock: {
    activePlayerQueue: undefined as PlayerQueue | undefined,
    showFullscreenPlayer: true,
    enabledPlugins: new Set<string>(),
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => true },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    providers: {
      "test_provider--1": { available: true, supported_features: [] },
    },
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

  it("adds the existing share preview action for a supported queue track", () => {
    storeMock.enabledPlugins.add("share_provider");
    const mediaItem = track({ provider_mappings: [providerMapping()] });

    const items = getQueueItemMenuItems(
      queueItem({ media_item: mediaItem }),
      3,
    );

    expect(labels(items)).toContain("share.open_preview");
  });
});
