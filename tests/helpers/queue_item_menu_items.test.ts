import type { NewBookmark } from "@/helpers/bookmarks";
import { getQueueItemMenuItems } from "@/helpers/queue_item_menu_items";
import {
  MediaType,
  ProviderFeature,
  type PlayerQueue,
  type ProviderInstance,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";
import { podcastEpisode } from "../fixtures/podcastEpisode";
import { providerInstance } from "../fixtures/providerInstance";
import { queueItem } from "../fixtures/queueItem";
import { streamDetails } from "../fixtures/streamDetails";
import { track } from "../fixtures/track";

const { storeMock, apiMock } = vi.hoisted(() => ({
  storeMock: {
    activePlayerQueue: undefined as PlayerQueue | undefined,
    curQueueItem: undefined as QueueItem | undefined,
    showFullscreenPlayer: true,
  },
  apiMock: {
    providers: {} as Record<string, ProviderInstance>,
    queueCommandPlayIndex: vi.fn(),
    queueCommandMoveNext: vi.fn(),
    queueCommandMoveItemEnd: vi.fn(),
    queueCommandDelete: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock }));
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => true },
}));
vi.mock("@/helpers/activeElapsedTime", () => ({
  resolveActiveElapsedTime: () => 754.9,
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

  // the copy that plays keeps it if it can, otherwise Music Assistant does
  it.each([
    ["item-1", [ProviderFeature.PODCAST_EPISODE_BOOKMARKS_EDIT], "Podcasts"],
    ["item-1", [], "Music Assistant"],
    ["item-2", [], undefined],
  ])(
    "offers a bookmark on the playing item only",
    (playingId, features, storedIn) => {
      apiMock.providers = {
        "rss--1": providerInstance({
          domain: "rss",
          name: "Podcasts",
          supported_features: features,
        }),
      };
      const item = queueItem({
        media_item: podcastEpisode({ item_id: "ep1", provider: "rss--1" }),
        streamdetails: streamDetails({ provider: "rss--1", item_id: "ep1" }),
      });
      storeMock.curQueueItem = { ...item, queue_item_id: playingId };
      const added: NewBookmark[] = [];
      const onAdd = (evt: NewBookmark) => added.push(evt);
      eventbus.on("addBookmark", onAdd);

      getQueueItemMenuItems(item, 0)
        .find((x) => x.label === "add_bookmark")
        ?.action?.();

      expect(added).toEqual(
        storedIn
          ? [
              {
                mediaType: MediaType.PODCAST_EPISODE,
                providerInstanceId: "rss--1",
                providerItemId: "ep1",
                storedIn,
                start: 754,
              },
            ]
          : [],
      );
      eventbus.off("addBookmark", onAdd);
    },
  );
});
