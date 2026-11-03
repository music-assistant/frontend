import {
  MediaType,
  ProviderFeature,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../tests/fixtures/scopes";
import { newBookmarkOfPlayingItem } from "./useBookmarks";

const ABS = "audiobookshelf--1";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: { providers: {} as Record<string, unknown> },
  storeMock: { curQueueItem: undefined as unknown },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/helpers/activeElapsedTime", () => ({
  resolveActiveElapsedTime: () => 754.6,
}));

function playing(media_type: MediaType, streamdetails = true) {
  storeMock.curQueueItem = {
    media_item: { media_type },
    streamdetails: streamdetails
      ? { provider: ABS, item_id: "book_1" }
      : undefined,
  } as unknown as QueueItem;
}

describe("newBookmarkOfPlayingItem", () => {
  beforeEach(() => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    apiMock.providers = {
      [ABS]: providerInstance({
        name: "Audiobookshelf",
        instance_id: ABS,
        supported_features: [ProviderFeature.AUDIOBOOK_BOOKMARKS_EDIT],
      }),
    };
  });

  // the provider keeps the bookmarks of the media types it can edit
  it.each([
    [MediaType.AUDIOBOOK, "Audiobookshelf"],
    [MediaType.PODCAST_EPISODE, "Music Assistant"],
  ])("takes the playing copy at the whole second", (mediaType, storedIn) => {
    playing(mediaType);

    expect(newBookmarkOfPlayingItem()).toEqual({
      mediaType,
      providerInstanceId: ABS,
      providerItemId: "book_1",
      storedIn,
      start: 754,
    });
  });

  it.each([
    ["a track", MediaType.TRACK, true, BUILTIN_ROLE_SCOPES.user],
    [
      "no copy chosen yet",
      MediaType.AUDIOBOOK,
      false,
      BUILTIN_ROLE_SCOPES.user,
    ],
    ["a guest", MediaType.AUDIOBOOK, true, BUILTIN_ROLE_SCOPES.guest],
  ])("takes none for %s", (_case, mediaType, streamdetails, scopes) => {
    vi.mocked(authManager.hasScope).mockImplementation(scopeChecker(scopes));
    playing(mediaType, streamdetails);

    expect(newBookmarkOfPlayingItem()).toBeUndefined();
  });
});
