/**
 * Tests for the click/play-button behaviour that is now steered by the
 * player_queues core config (default_play_action_*_track and
 * default_click_action_*): handlePlayBtnClick and handleMediaItemClick both
 * became async so they can read the setting before deciding what to do, and
 * must keep today's default behaviour when that read fails.
 */
import type { MusicAssistantApi } from "@/plugins/api";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockPlayMedia, mockGetCoreConfigValue, mockRouterPush } = vi.hoisted(
  () => ({
    mockPlayMedia: vi.fn<MusicAssistantApi["playMedia"]>(),
    mockGetCoreConfigValue: vi.fn(),
    mockRouterPush: vi.fn(),
  }),
);

vi.mock("@/plugins/api", () => ({
  api: {
    serverInfo: { value: null },
    players: {},
    playMedia: mockPlayMedia,
    getCoreConfigValue: mockGetCoreConfigValue,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: {
    activePlayer: { available: true, player_id: "test_player" },
    activePlayerQueue: {
      queue_id: "test_queue",
      items: 10,
      state: "playing",
    },
  },
}));

vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: vi.fn(() => false),
}));

vi.mock("@/plugins/router", () => ({
  default: { push: mockRouterPush },
}));

vi.mock("@/plugins/web_player", () => ({
  webPlayer: { player_id: null },
  WebPlayerMode: {},
}));

vi.mock("@/layouts/default/ItemContextMenu.vue", () => ({
  showContextMenuForMediaItem: vi.fn(),
  showPlayMenuForMediaItem: vi.fn(),
}));

vi.mock("@/plugins/api/helpers", () => ({
  itemIsAvailable: vi.fn(() => true),
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn() },
}));

import {
  handleMediaItemClick,
  handlePlayBtnClick,
} from "@/helpers/media_item_actions";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { playlist } from "../fixtures/playlist";
import { track } from "../fixtures/track";

const playedTrack = track({ item_id: "track1", name: "Track 1" });
const parentPlaylist = playlist({ item_id: "pl1", name: "Playlist 1" });
const parentAlbum = album({ item_id: "alb1", name: "Album 1" });

beforeEach(() => {
  mockPlayMedia.mockReset();
  mockPlayMedia.mockResolvedValue(undefined);
  mockGetCoreConfigValue.mockReset();
  mockRouterPush.mockReset();
});

describe("handlePlayBtnClick honours default_play_action_*_track", () => {
  it("plays just the track when the playlist setting is 'play_track'", async () => {
    mockGetCoreConfigValue.mockResolvedValue("play_track");

    await handlePlayBtnClick(playedTrack, 0, 0, parentPlaylist);

    expect(mockGetCoreConfigValue).toHaveBeenCalledWith(
      "player_queues",
      "default_play_action_playlist_track",
    );
    expect(mockPlayMedia).toHaveBeenCalledWith(playedTrack);
  });

  it("plays just the track when the album setting is 'play_track'", async () => {
    mockGetCoreConfigValue.mockResolvedValue("play_track");

    await handlePlayBtnClick(playedTrack, 0, 0, parentAlbum);

    expect(mockGetCoreConfigValue).toHaveBeenCalledWith(
      "player_queues",
      "default_play_action_album_track",
    );
    expect(mockPlayMedia).toHaveBeenCalledWith(playedTrack);
  });

  it("plays the playlist from the track when the setting is 'play_from_here'", async () => {
    mockGetCoreConfigValue.mockResolvedValue("play_from_here");

    await handlePlayBtnClick(playedTrack, 0, 0, parentPlaylist, false, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(parentPlaylist.uri, undefined, {
      start_item: playedTrack.item_id,
      sort_by: "name",
    });
  });

  it("plays the album from the track when the setting is any other/unexpected value", async () => {
    mockGetCoreConfigValue.mockResolvedValue("some_future_value");

    await handlePlayBtnClick(playedTrack, 0, 0, parentAlbum);

    expect(mockPlayMedia).toHaveBeenCalledWith(parentAlbum.uri, undefined, {
      start_item: playedTrack.item_id,
      sort_by: undefined,
    });
  });

  it("falls back to play-from-here when the config read rejects", async () => {
    mockGetCoreConfigValue.mockRejectedValue(new Error("no connection"));

    await handlePlayBtnClick(playedTrack, 0, 0, parentPlaylist);

    expect(mockPlayMedia).toHaveBeenCalledWith(parentPlaylist.uri, undefined, {
      start_item: playedTrack.item_id,
      sort_by: undefined,
    });
  });
});

describe("handleMediaItemClick honours default_click_action_*", () => {
  it.each([
    { item: album({ item_id: "a1" }), key: "default_click_action_album" },
    { item: artist({ item_id: "ar1" }), key: "default_click_action_artist" },
    {
      item: playlist({ item_id: "pl2" }),
      key: "default_click_action_playlist",
    },
  ])(
    "plays $item.media_type directly when its click-action setting is 'play'",
    async ({ item, key }) => {
      mockGetCoreConfigValue.mockResolvedValue("play");

      await handleMediaItemClick(item, 0, 0);

      expect(mockGetCoreConfigValue).toHaveBeenCalledWith("player_queues", key);
      expect(mockPlayMedia).toHaveBeenCalledWith(item);
      expect(mockRouterPush).not.toHaveBeenCalled();
    },
  );

  it.each([
    { item: album({ item_id: "a1" }) },
    { item: artist({ item_id: "ar1" }) },
    { item: playlist({ item_id: "pl2" }) },
  ])(
    "opens the details view for $item.media_type when the setting is 'browse'",
    async ({ item }) => {
      mockGetCoreConfigValue.mockResolvedValue("browse");

      await handleMediaItemClick(item, 0, 0);

      expect(mockRouterPush).toHaveBeenCalledWith({
        name: item.media_type,
        params: {
          itemId: item.item_id,
          provider: item.provider,
        },
      });
      expect(mockPlayMedia).not.toHaveBeenCalled();
    },
  );

  it("opens the details view when the setting resolves to an unexpected value", async () => {
    const theAlbum = album({ item_id: "a1" });
    mockGetCoreConfigValue.mockResolvedValue("something_else");

    await handleMediaItemClick(theAlbum, 0, 0);

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: theAlbum.media_type,
      params: {
        itemId: theAlbum.item_id,
        provider: theAlbum.provider,
      },
    });
    expect(mockPlayMedia).not.toHaveBeenCalled();
  });

  it("falls back to the details view when the config read rejects", async () => {
    const theArtist = artist({ item_id: "ar1" });
    mockGetCoreConfigValue.mockRejectedValue(new Error("no connection"));

    await handleMediaItemClick(theArtist, 0, 0);

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: theArtist.media_type,
      params: {
        itemId: theArtist.item_id,
        provider: theArtist.provider,
      },
    });
    expect(mockPlayMedia).not.toHaveBeenCalled();
  });
});
