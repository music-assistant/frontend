/**
 * Tests that "play from here" actions correctly pass the sortBy parameter
 * through handlePlayBtnClick and handleMenuBtnClick to the API / context menu.
 */
import type { MusicAssistantApi } from "@/plugins/api";
import { SortDirection, SortField } from "@/plugins/api/interfaces";
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

// signed in as a member
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../fixtures/scopes");
  return {
    authManager: { hasScope: vi.fn(scopeChecker(BUILTIN_ROLE_SCOPES.user)) },
  };
});

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
  // what the real helper does, which this module-wide mock would otherwise hide
  isMusicBrainzItem: (item: { provider: string }) =>
    item.provider === "musicbrainz",
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
  mockShowPlayMenu.mockResolvedValue(undefined);
  mockGetCoreConfigValue.mockReset();
  mockGetCoreConfigValue.mockResolvedValue("play_from_here");
});

describe("handlePlayBtnClick with sortBy", () => {
  it("passes sortBy to api.playMedia for playlist play-from-here", async () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    await handlePlayBtnClick(playedTrack, 0, 0, parentPlaylist, false, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(parentPlaylist.uri, undefined, {
      start_item: playedTrack.item_id,
      sort_by: "name",
    });
  });

  it("passes undefined sortBy when not provided", async () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    await handlePlayBtnClick(playedTrack, 0, 0, parentPlaylist);

    expect(mockPlayMedia).toHaveBeenCalledWith(parentPlaylist.uri, undefined, {
      start_item: playedTrack.item_id,
      sort_by: undefined,
    });
  });

  it("passes sortBy for album play-from-here", async () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentAlbum = makeAlbum("alb1");

    await handlePlayBtnClick(playedTrack, 0, 0, parentAlbum, false, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(parentAlbum.uri, undefined, {
      start_item: playedTrack.item_id,
      sort_by: "name",
    });
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
        {
          start_item: playedTrack.item_id,
          sort_by: sortKey,
        },
      );
    }
  });
});

describe("handlePlayBtnClick with typed sort fields", () => {
  it("plays from a track using the server listing's typed sort", async () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    await handlePlayBtnClick(
      playedTrack,
      0,
      0,
      parentPlaylist,
      false,
      undefined,
      undefined,
      SortField.DURATION,
      SortDirection.DESC,
    );

    expect(mockPlayMedia).toHaveBeenCalledWith(parentPlaylist.uri, undefined, {
      start_item: playedTrack.item_id,
      sort_field: SortField.DURATION,
      sort_direction: SortDirection.DESC,
    });
  });

  it("plays a container from its hero using its tracks sort fields", async () => {
    const albumItem = makeAlbum("album-1");

    await handlePlayBtnClick(
      albumItem,
      0,
      0,
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      SortField.SORT_NAME,
      SortDirection.ASC,
    );

    expect(mockPlayMedia).toHaveBeenCalledWith(albumItem, undefined, {
      sort_field: SortField.SORT_NAME,
      sort_direction: SortDirection.ASC,
    });
  });

  it("passes typed sorts to the context-menu play-from-here action", () => {
    const playedTrack = makePlaylistTrack("track1");
    const parentPlaylist = makePlaylist("pl1");

    handleMenuBtnClick(
      playedTrack,
      100,
      200,
      parentPlaylist,
      true,
      undefined,
      SortField.NAME,
      SortDirection.ASC,
    );

    expect(mockShowContextMenu).toHaveBeenCalledWith(
      [playedTrack],
      parentPlaylist,
      100,
      200,
      true,
      true,
      undefined,
      undefined,
      SortField.NAME,
      SortDirection.ASC,
    );
  });
});

describe("handlePlayBtnClick with tracksSortBy", () => {
  it("plays a playlist in the order its page lists the tracks", async () => {
    const pl = makePlaylist("pl1");

    await handlePlayBtnClick(pl, 0, 0, undefined, false, undefined, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(pl, undefined, {
      sort_by: "name",
    });
  });

  it("plays an album in the order its page lists the tracks", async () => {
    const al = makeAlbum("al1");

    await handlePlayBtnClick(al, 0, 0, undefined, false, undefined, "duration");

    expect(mockPlayMedia).toHaveBeenCalledWith(al, undefined, {
      sort_by: "duration",
    });
  });

  it("ignores the sort of the listing the item is shown in", async () => {
    const pl = makePlaylist("pl1");

    await handlePlayBtnClick(pl, 0, 0, undefined, false, "name");

    expect(mockPlayMedia).toHaveBeenCalledWith(pl);
  });

  it("hands tracksSortBy to the play menu", async () => {
    const pl = makePlaylist("pl1");

    await handlePlayBtnClick(pl, 1, 2, undefined, true, undefined, "artist");

    expect(mockShowPlayMenu).toHaveBeenCalledWith(
      pl,
      undefined,
      1,
      2,
      "artist",
      undefined,
      undefined,
    );
    expect(mockPlayMedia).not.toHaveBeenCalled();
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
      undefined,
      undefined,
      undefined,
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
      undefined,
      undefined,
      undefined,
    );
  });
});
