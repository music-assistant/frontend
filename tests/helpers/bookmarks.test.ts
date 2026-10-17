import { newBookmarkOfPlayingItem } from "@/helpers/bookmarks";
import {
  MediaType,
  ProviderFeature,
  type ProviderInstance,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";
import { podcastEpisode } from "../fixtures/podcastEpisode";
import { providerInstance } from "../fixtures/providerInstance";
import { queueItem } from "../fixtures/queueItem";
import { streamDetails } from "../fixtures/streamDetails";
import { track } from "../fixtures/track";

const { storeMock, apiMock } = vi.hoisted(() => ({
  storeMock: { curQueueItem: undefined as QueueItem | undefined },
  apiMock: { providers: {} as Record<string, ProviderInstance> },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => true },
}));
vi.mock("@/helpers/activeElapsedTime", () => ({
  resolveActiveElapsedTime: () => 754.9,
}));

describe("newBookmarkOfPlayingItem", () => {
  // the copy that plays keeps it if it can, otherwise Music Assistant does
  it.each([
    [
      podcastEpisode(),
      [ProviderFeature.PODCAST_EPISODE_BOOKMARKS_EDIT],
      "Podcasts",
    ],
    [podcastEpisode(), [], "Music Assistant"],
    [track(), [], undefined],
  ])("bookmarks the playing copy", (mediaItem, features, storedIn) => {
    apiMock.providers = {
      "rss--1": providerInstance({
        domain: "rss",
        name: "Podcasts",
        supported_features: features,
      }),
    };
    storeMock.curQueueItem = queueItem({
      media_item: mediaItem,
      streamdetails: streamDetails({ provider: "rss--1", item_id: "ep1" }),
    });

    expect(newBookmarkOfPlayingItem()).toEqual(
      storedIn && {
        mediaType: MediaType.PODCAST_EPISODE,
        providerInstanceId: "rss--1",
        providerItemId: "ep1",
        storedIn,
        start: 754,
      },
    );
  });
});
