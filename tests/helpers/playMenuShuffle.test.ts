/**
 * Tests for the "play shuffled" action in the play menu.
 *
 * It is an action rather than a state indicator: the queue's own shuffle flag says
 * nothing about the media that is about to be started, so the action always asks
 * for shuffle explicitly. It is only offered on servers that accept that request.
 */
import type { MusicAssistantApi } from "@/plugins/api";
import { QueueOption, type PlayerQueue } from "@/plugins/api/interfaces";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
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

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
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

import { showPlayMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { genre } from "../fixtures/genre";
import { playerQueue } from "../fixtures/playerQueue";
import { podcast } from "../fixtures/podcast";
import { track } from "../fixtures/track";

// the items the play menu was opened with, as handed to the contextmenu event
const emittedItems = (): ContextMenuItem[] =>
  mockEventbusEmit.mock.calls[0][1].items;

const shuffleAction = (): ContextMenuItem | undefined =>
  emittedItems().find((x) => x.label === "play_shuffled");

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

describe("play shuffled action presence", () => {
  it.each([
    ["album", album({ item_id: "a1" })],
    ["artist", artist({ item_id: "ar1" })],
    ["genre", genre({ item_id: "g1", is_playable: true })],
  ])("is offered for a %s", async (_name, item) => {
    await showPlayMenuForMediaItem(item);
    expect(shuffleAction()).toBeDefined();
  });

  it("is offered for a multi-item selection of non-container types", async () => {
    await showPlayMenuForMediaItem([
      track({ item_id: "t1" }),
      track({ item_id: "t2" }),
    ]);
    expect(shuffleAction()).toBeDefined();
  });

  it("is not offered for a single track", async () => {
    await showPlayMenuForMediaItem(track({ item_id: "t1" }));
    expect(shuffleAction()).toBeUndefined();
  });

  it("is not offered for spoken-word content, meant to be heard in order", async () => {
    await showPlayMenuForMediaItem(podcast({ item_id: "pc1" }));
    expect(shuffleAction()).toBeUndefined();
  });

  it("is not offered when the server does not accept a shuffle request", async () => {
    mockApi.supportsPlayMediaShuffle = false;
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleAction()).toBeUndefined();
  });

  it("is offered regardless of the queue's own shuffle state", async () => {
    mockStore.activePlayerQueue = playerQueue({ shuffle_enabled: true });
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleAction()).toBeDefined();
  });

  it("is never marked as the selected/default action", async () => {
    mockStore.activePlayerQueue = playerQueue({ shuffle_enabled: true });
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleAction()?.selected).toBeUndefined();
  });
});

describe("play shuffled action behaviour", () => {
  it("replaces the queue and asks for shuffle explicitly", async () => {
    const theAlbum = album({ item_id: "a1" });
    await showPlayMenuForMediaItem(theAlbum);
    shuffleAction()?.action?.();

    expect(mockApi.playMedia).toHaveBeenCalledWith(
      [theAlbum.uri],
      QueueOption.REPLACE,
      { shuffle: true },
    );
  });

  it("plays every selected item shuffled", async () => {
    const first = track({ item_id: "t1" });
    const second = track({ item_id: "t2" });
    await showPlayMenuForMediaItem([first, second]);
    shuffleAction()?.action?.();

    expect(mockApi.playMedia).toHaveBeenCalledWith(
      [first.uri, second.uri],
      QueueOption.REPLACE,
      { shuffle: true },
    );
  });

  it("leaves the normal play options without a shuffle request", async () => {
    const theAlbum = album({ item_id: "a1" });
    await showPlayMenuForMediaItem(theAlbum);
    emittedItems()
      .find((x) => x.label === `queue_option.${QueueOption.PLAY}`)
      ?.action?.();

    expect(mockApi.playMedia).toHaveBeenCalledWith(
      [theAlbum.uri],
      QueueOption.PLAY,
    );
  });

  it("is disabled when there is no active player", async () => {
    mockStore.activePlayer = undefined;
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleAction()?.disabled).toBe(true);
  });
});
