/**
 * Regression test: a failing play action must surface an error toast.
 * Previously both api.playMedia rejections and showPlayMenuForMediaItem
 * failures were swallowed, leaving the play button a silent no-op
 * (e.g. while the API connection is re-establishing after a server restart).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockPlayMedia, mockShowPlayMenu, mockToastError, mockStore } =
  vi.hoisted(() => ({
    mockPlayMedia: vi.fn(),
    mockShowPlayMenu: vi.fn(),
    mockToastError: vi.fn(),
    mockStore: {
      activePlayer: undefined as Record<string, unknown> | undefined,
      activePlayerQueue: undefined as Record<string, unknown> | undefined,
    },
  }));

vi.mock("@/plugins/api", () => ({
  api: {
    serverInfo: { value: null },
    players: {},
    playMedia: mockPlayMedia,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: mockStore,
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
  showContextMenuForMediaItem: vi.fn(),
  showPlayMenuForMediaItem: mockShowPlayMenu,
}));

vi.mock("@/plugins/api/helpers", () => ({
  itemIsAvailable: vi.fn(),
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: { error: mockToastError },
}));

import { handlePlayBtnClick } from "@/helpers/utils";
import { MediaType, type Playlist, type Track } from "@/plugins/api/interfaces";

const track = {
  item_id: "track1",
  uri: "library://track/track1",
  media_type: MediaType.TRACK,
  name: "Track 1",
  is_playable: true,
} as unknown as Track;

const playlist = {
  item_id: "pl1",
  uri: "library://playlist/pl1",
  media_type: MediaType.PLAYLIST,
  name: "Playlist 1",
  is_playable: true,
} as unknown as Playlist;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mockPlayMedia.mockReset();
  mockShowPlayMenu.mockReset();
  mockToastError.mockReset();
  mockStore.activePlayer = { available: true, player_id: "test_player" };
  mockStore.activePlayerQueue = { queue_id: "test_queue" };
});

describe("handlePlayBtnClick error feedback", () => {
  it("shows a toast when direct play fails", async () => {
    mockPlayMedia.mockRejectedValue(new Error("Connection lost"));

    handlePlayBtnClick(track, 0, 0);
    await flushPromises();

    expect(mockToastError).toHaveBeenCalledWith("play_failed");
  });

  it("shows a toast when play-from-here fails", async () => {
    mockPlayMedia.mockRejectedValue(new Error("Connection lost"));

    handlePlayBtnClick(track, 0, 0, playlist);
    await flushPromises();

    expect(mockToastError).toHaveBeenCalledWith("play_failed");
  });

  it("shows a toast when opening the play menu fails", async () => {
    mockStore.activePlayer = undefined;
    mockShowPlayMenu.mockRejectedValue(new Error("Connection lost"));

    handlePlayBtnClick(track, 0, 0);
    await flushPromises();

    expect(mockToastError).toHaveBeenCalledWith("play_failed");
  });

  it("does not show a toast when play succeeds", async () => {
    mockPlayMedia.mockResolvedValue(undefined);

    handlePlayBtnClick(track, 0, 0);
    await flushPromises();

    expect(mockToastError).not.toHaveBeenCalled();
  });
});
