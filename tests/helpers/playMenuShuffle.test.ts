/**
 * Tests for the shuffle toggle in the play menu (createShuffleToggle, exercised
 * through the exported getPlaybackContextMenuItems / showPlayMenuForMediaItem).
 *
 * The toggle only appears when the connected server accepts an explicit
 * shuffle argument on play_media (api.supportsPlayMediaShuffle) and there is
 * an active player queue to shuffle; otherwise every play action must keep
 * sending shuffle === undefined so the server falls back to its own default.
 */
import type { MusicAssistantApi } from "@/plugins/api";
import { QueueOption, type PlayerQueue } from "@/plugins/api/interfaces";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockApi, mockStore, mockEventbusEmit } = vi.hoisted(() => ({
  mockApi: {
    getCoreConfigValue: vi.fn(),
    playMedia: vi.fn<MusicAssistantApi["playMedia"]>(),
    getLibraryItem: vi.fn(),
    players: {},
    supportsPlayMediaShuffle: true,
  },
  mockStore: {
    activePlayer: undefined as Record<string, unknown> | undefined,
    activePlayerId: undefined,
    activePlayerQueue: undefined as PlayerQueue | undefined,
    dialogActive: false,
    enabledPlugins: new Set<string>(),
  },
  mockEventbusEmit: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: mockApi,
  api: mockApi,
}));

vi.mock("@/plugins/store", () => ({
  store: mockStore,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: mockEventbusEmit,
  },
}));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/web_player", () => ({
  webPlayer: { player_id: null },
  WebPlayerMode: {},
}));

vi.mock("@/helpers/players", () => ({
  playerVisible: () => true,
}));

vi.mock("@/helpers/icon", () => ({
  getLucideIcon: () => undefined,
  PLAYER_ICON_FALLBACK: "speaker",
}));

vi.mock("@/plugins/api/helpers", () => ({
  isItemInLibrary: vi.fn(() => true),
  itemIsAvailable: vi.fn(() => true),
  itemSupportsPlayLog: vi.fn(() => false),
}));

import {
  getPlaybackContextMenuItems,
  showPlayMenuForMediaItem,
} from "@/layouts/default/ItemContextMenu.vue";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { playerQueue } from "../fixtures/playerQueue";
import { playlist } from "../fixtures/playlist";
import { track } from "../fixtures/track";

const findShuffleItem = (
  items: Array<{ label: string }>,
): { label: string; selected?: boolean; action?: () => void } | undefined =>
  items.find((x) => x.label === "shuffle") as
    | { label: string; selected?: boolean; action?: () => void }
    | undefined;

beforeEach(() => {
  mockApi.getCoreConfigValue.mockReset();
  mockApi.getCoreConfigValue.mockResolvedValue(QueueOption.PLAY);
  mockApi.playMedia.mockReset();
  mockApi.playMedia.mockResolvedValue(undefined);
  mockApi.getLibraryItem.mockReset();
  mockApi.supportsPlayMediaShuffle = true;
  mockStore.activePlayer = { available: true, player_id: "test_player" };
  mockStore.activePlayerQueue = playerQueue({ shuffle_enabled: false });
  mockEventbusEmit.mockReset();
});

describe("shuffle toggle presence", () => {
  it("is present for a container (album) when schema supports it and a queue is active", async () => {
    const theAlbum = album({ item_id: "a1" });
    const items = await getPlaybackContextMenuItems([theAlbum]);
    expect(findShuffleItem(items)).toBeDefined();
  });

  it("is absent when the server does not support play_media shuffle", async () => {
    mockApi.supportsPlayMediaShuffle = false;
    const theAlbum = album({ item_id: "a1" });
    const items = await getPlaybackContextMenuItems([theAlbum]);
    expect(findShuffleItem(items)).toBeUndefined();
  });

  it("is absent when there is no active player queue", async () => {
    mockStore.activePlayerQueue = undefined;
    const theAlbum = album({ item_id: "a1" });
    const items = await getPlaybackContextMenuItems([theAlbum]);
    expect(findShuffleItem(items)).toBeUndefined();
  });

  it("is absent for a single track with no shuffleable container parent", async () => {
    const theTrack = track({ item_id: "t1" });
    const items = await getPlaybackContextMenuItems([theTrack]);
    expect(findShuffleItem(items)).toBeUndefined();
  });

  it("is present for a single track played from within a playlist parent", async () => {
    const theTrack = track({ item_id: "t1" });
    const parentPlaylist = playlist({ item_id: "pl1" });
    const items = await getPlaybackContextMenuItems([theTrack], parentPlaylist);
    expect(findShuffleItem(items)).toBeDefined();
  });

  it("is present for a multi-item selection even of non-container types", async () => {
    const items = await getPlaybackContextMenuItems([
      track({ item_id: "t1" }),
      track({ item_id: "t2" }),
    ]);
    expect(findShuffleItem(items)).toBeDefined();
  });

  it("is present in showPlayMenuForMediaItem's items for an artist", async () => {
    const theArtist = artist({ item_id: "ar1" });
    await showPlayMenuForMediaItem(theArtist);
    expect(mockEventbusEmit).toHaveBeenCalledWith(
      "contextmenu",
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ label: "shuffle" }),
        ]),
      }),
    );
  });
});

describe("shuffle toggle state", () => {
  it("mirrors the active queue's shuffle_enabled as its initial selected state", async () => {
    mockStore.activePlayerQueue = playerQueue({ shuffle_enabled: true });
    const theAlbum = album({ item_id: "a1" });
    const items = await getPlaybackContextMenuItems([theAlbum]);
    expect(findShuffleItem(items)?.selected).toBe(true);
  });

  it("starts unselected when the queue is not shuffling", async () => {
    mockStore.activePlayerQueue = playerQueue({ shuffle_enabled: false });
    const theAlbum = album({ item_id: "a1" });
    const items = await getPlaybackContextMenuItems([theAlbum]);
    expect(findShuffleItem(items)?.selected).toBe(false);
  });
});

describe("shuffle value passed to playMedia", () => {
  it("passes shuffle === undefined while the toggle has not been touched", async () => {
    const theAlbum = album({ item_id: "a1" });
    const items = await getPlaybackContextMenuItems([theAlbum]);
    const playNow = items.find((x) => x.label === "play_now");
    playNow?.action?.();

    expect(mockApi.playMedia).toHaveBeenCalledWith(
      [theAlbum.uri],
      QueueOption.PLAY,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it("passes the flipped boolean after the toggle's action() is called", async () => {
    const theAlbum = album({ item_id: "a1" });
    const items = await getPlaybackContextMenuItems([theAlbum]);
    const shuffleItem = findShuffleItem(items);
    shuffleItem?.action?.();

    const playNow = items.find((x) => x.label === "play_now");
    playNow?.action?.();

    expect(mockApi.playMedia).toHaveBeenCalledWith(
      [theAlbum.uri],
      QueueOption.PLAY,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
  });

  it("flips back to the original state on a second toggle", async () => {
    const theAlbum = album({ item_id: "a1" });
    const items = await getPlaybackContextMenuItems([theAlbum]);
    const shuffleItem = findShuffleItem(items);
    // queue starts with shuffle_enabled: false -> first flip requests true,
    // second flip requests false again
    shuffleItem?.action?.();
    shuffleItem?.action?.();

    const playNow = items.find((x) => x.label === "play_now");
    playNow?.action?.();

    expect(mockApi.playMedia).toHaveBeenCalledWith(
      [theAlbum.uri],
      QueueOption.PLAY,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );
  });

  it("passes the requested shuffle value through a play-from-here (playlist track) action", async () => {
    const theTrack = track({ item_id: "t1" });
    const parentPlaylist = playlist({ item_id: "pl1" });
    const items = await getPlaybackContextMenuItems([theTrack], parentPlaylist);
    const shuffleItem = findShuffleItem(items);
    shuffleItem?.action?.();

    const playFromHere = items.find((x) => x.label === "play_playlist_from");
    playFromHere?.action?.();

    expect(mockApi.playMedia).toHaveBeenCalledWith(
      parentPlaylist.uri,
      undefined,
      theTrack.item_id,
      undefined,
      undefined,
      undefined,
      true,
    );
  });
});
