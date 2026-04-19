/**
 * Tests that "play from here" actions correctly pass the sortBy parameter
 * through handlePlayBtnClick and handleMenuBtnClick to the API / context menu.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockPlayMedia, mockShowContextMenu, mockShowPlayMenu } = vi.hoisted(
  () => ({
    mockPlayMedia: vi.fn(),
    mockShowContextMenu: vi.fn(),
    mockShowPlayMenu: vi.fn(),
  }),
);

vi.mock("@/plugins/api", () => ({
  api: {
    serverInfo: { value: null },
    players: {},
    playMedia: mockPlayMedia,
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
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/web_player", () => ({
  webPlayer: { player_id: null },
  WebPlayerMode: {},
}));

vi.mock("@/layouts/default/ItemContextMenu.vue", () => ({
  showContextMenuForMediaItem: mockShowContextMenu,
  showPlayMenuForMediaItem: mockShowPlayMenu,
}));

vi.mock("@/plugins/api/helpers", () => ({
  itemIsAvailable: vi.fn(),
}));

vi.mock("colorthief", () => ({
  default: class {
    getPalette() {
      return [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0],
        [255, 0, 255],
      ];
    }
  },
}));

import { handlePlayBtnClick, handleMenuBtnClick } from "@/helpers/utils";
import { MediaType } from "@/plugins/api/interfaces";

const makePlaylistTrack = (id: string) =>
  ({
    item_id: id,
    uri: `library://track/${id}`,
    media_type: MediaType.TRACK,
    name: `Track ${id}`,
    is_playable: true,
  }) as any;

const makePlaylist = (id: string) =>
  ({
    item_id: id,
    uri: `library://playlist/${id}`,
    media_type: MediaType.PLAYLIST,
    name: `Playlist ${id}`,
    is_playable: true,
  }) as any;

const makeAlbum = (id: string) =>
  ({
    item_id: id,
    uri: `library://album/${id}`,
    media_type: MediaType.ALBUM,
    name: `Album ${id}`,
    is_playable: true,
  }) as any;

beforeEach(() => {
  mockPlayMedia.mockReset();
  mockShowContextMenu.mockReset();
  mockShowPlayMenu.mockReset();
});

describe("handlePlayBtnClick with sortBy", () => {
  it("passes sortBy to api.playMedia for playlist play-from-here", () => {
    const track = makePlaylistTrack("track1");
    const playlist = makePlaylist("pl1");

    handlePlayBtnClick(track, 0, 0, playlist, false, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(
      playlist.uri,
      undefined,
      false,
      track.item_id,
      undefined,
      "name",
    );
  });

  it("passes undefined sortBy when not provided", () => {
    const track = makePlaylistTrack("track1");
    const playlist = makePlaylist("pl1");

    handlePlayBtnClick(track, 0, 0, playlist);

    expect(mockPlayMedia).toHaveBeenCalledWith(
      playlist.uri,
      undefined,
      false,
      track.item_id,
      undefined,
      undefined,
    );
  });

  it("passes sortBy for album play-from-here", () => {
    const track = makePlaylistTrack("track1");
    const album = makeAlbum("alb1");

    handlePlayBtnClick(track, 0, 0, album, false, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(
      album.uri,
      undefined,
      false,
      track.item_id,
      undefined,
      "name",
    );
  });

  it("passes different sort keys correctly", () => {
    const track = makePlaylistTrack("track1");
    const playlist = makePlaylist("pl1");

    for (const sortKey of [
      "artist",
      "album",
      "duration",
      "duration_desc",
      "position_desc",
    ]) {
      mockPlayMedia.mockReset();
      handlePlayBtnClick(track, 0, 0, playlist, false, sortKey);
      expect(mockPlayMedia).toHaveBeenCalledWith(
        playlist.uri,
        undefined,
        false,
        track.item_id,
        undefined,
        sortKey,
      );
    }
  });
});

describe("handleMenuBtnClick with sortBy", () => {
  it("passes sortBy to showContextMenuForMediaItem", () => {
    const track = makePlaylistTrack("track1");
    const playlist = makePlaylist("pl1");

    handleMenuBtnClick(track, 100, 200, playlist, true, "duration");

    expect(mockShowContextMenu).toHaveBeenCalledWith(
      [track],
      playlist,
      100,
      200,
      true,
      true,
      "duration",
    );
  });

  it("passes undefined sortBy when not provided", () => {
    const track = makePlaylistTrack("track1");
    const playlist = makePlaylist("pl1");

    handleMenuBtnClick(track, 100, 200, playlist);

    expect(mockShowContextMenu).toHaveBeenCalledWith(
      [track],
      playlist,
      100,
      200,
      true,
      true,
      undefined,
    );
  });
});
