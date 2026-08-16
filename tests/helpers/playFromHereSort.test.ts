/**
 * Tests that "play from here" actions correctly pass the sortBy parameter
 * through handlePlayBtnClick and handleMenuBtnClick to the API / context menu.
 */
import type { MusicAssistantApi } from "@/plugins/api";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  mockPlayMedia,
  mockShowContextMenu,
  mockShowPlayMenu,
  mockGetCoreConfigValue,
} = vi.hoisted(() => ({
  mockPlayMedia: vi.fn<MusicAssistantApi["playMedia"]>(),
  mockShowContextMenu: vi.fn(),
  mockShowPlayMenu: vi.fn(),
  mockGetCoreConfigValue: vi.fn(),
}));

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

import {
  handlePlayBtnClick,
  handleMenuBtnClick,
} from "@/helpers/media_item_actions";
import { album } from "../fixtures/album";
import { playlist } from "../fixtures/playlist";
import { track } from "../fixtures/track";

const makePlaylistTrack = (id: string) =>
  track({ item_id: id, name: `Track ${id}` });

const makePlaylist = (id: string) =>
  playlist({
    item_id: id,
    name: `Playlist ${id}`,
  });

const makeAlbum = (id: string) => album({ item_id: id, name: `Album ${id}` });

beforeEach(() => {
  mockPlayMedia.mockReset();
  mockPlayMedia.mockResolvedValue(undefined);
  mockShowContextMenu.mockReset();
  mockShowPlayMenu.mockReset();
  mockGetCoreConfigValue.mockReset();
  mockGetCoreConfigValue.mockResolvedValue("play_from_here");
});

describe("handlePlayBtnClick with sortBy", () => {
  it("passes sortBy to api.playMedia for playlist play-from-here", async () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    await handlePlayBtnClick(playedTrack, 0, 0, parentPlaylist, false, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(
      parentPlaylist.uri,
      undefined,
      playedTrack.item_id,
      undefined,
      "name",
    );
  });

  it("passes undefined sortBy when not provided", async () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    await handlePlayBtnClick(playedTrack, 0, 0, parentPlaylist);

    expect(mockPlayMedia).toHaveBeenCalledWith(
      parentPlaylist.uri,
      undefined,
      playedTrack.item_id,
      undefined,
      undefined,
    );
  });

  it("passes sortBy for album play-from-here", async () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentAlbum = makeAlbum("alb1");

    await handlePlayBtnClick(playedTrack, 0, 0, parentAlbum, false, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(
      parentAlbum.uri,
      undefined,
      playedTrack.item_id,
      undefined,
      "name",
    );
  });

  it("passes different sort keys correctly", async () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    for (const sortKey of [
      "artist",
      "album",
      "duration",
      "duration_desc",
      "position_desc",
    ]) {
      mockPlayMedia.mockClear();
      await handlePlayBtnClick(
        playedTrack,
        0,
        0,
        parentPlaylist,
        false,
        sortKey,
      );
      expect(mockPlayMedia).toHaveBeenCalledWith(
        parentPlaylist.uri,
        undefined,
        playedTrack.item_id,
        undefined,
        sortKey,
      );
    }
  });
});

describe("handleMenuBtnClick with sortBy", () => {
  it("passes sortBy to showContextMenuForMediaItem", () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    handleMenuBtnClick(playedTrack, 100, 200, parentPlaylist, true, "duration");

    expect(mockShowContextMenu).toHaveBeenCalledWith(
      [playedTrack],
      parentPlaylist,
      100,
      200,
      true,
      true,
      "duration",
    );
  });

  it("passes undefined sortBy when not provided", () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    handleMenuBtnClick(playedTrack, 100, 200, parentPlaylist);

    expect(mockShowContextMenu).toHaveBeenCalledWith(
      [playedTrack],
      parentPlaylist,
      100,
      200,
      true,
      true,
      undefined,
    );
  });
});
