/**
 * Tests for the shuffle toggle in the play menu (createShuffleToggle, exercised
 * through the exported showPlayMenuForMediaItem).
 *
 * The toggle only appears when the connected server accepts an explicit
 * shuffle argument on play_media (api.supportsPlayMediaShuffle) and there is
 * an active player queue to shuffle; otherwise every play action must keep
 * sending shuffle === undefined so the server falls back to its own default.
 */
import type { MusicAssistantApi } from "@/plugins/api";
import { QueueOption, type PlayerQueue } from "@/plugins/api/interfaces";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import type { VNode } from "vue";
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

import {
  getPlaybackContextMenuItems,
  showPlayMenuForMediaItem,
} from "@/layouts/default/ItemContextMenu.vue";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { genre } from "../fixtures/genre";
import { playerQueue } from "../fixtures/playerQueue";
import { podcast } from "../fixtures/podcast";
import { track } from "../fixtures/track";

// the items the play menu was opened with, as handed to the contextmenu event
const emittedItems = (): ContextMenuItem[] =>
  mockEventbusEmit.mock.calls[0][1].items;

const findItem = (label: string): ContextMenuItem | undefined =>
  emittedItems().find((x) => x.label === label);

const shuffleItem = () => findItem("shuffle");

// the switch row renders itself; read and drive it the way the rendered control does
const shuffleRowProps = (): Record<string, unknown> => {
  const render = shuffleItem()!.component as unknown as () => VNode;
  return (render().props ?? {}) as Record<string, unknown>;
};

const shuffleSwitchOn = (): boolean => shuffleRowProps().modelValue as boolean;

const flipShuffle = (value: boolean) =>
  (shuffleRowProps()["onUpdate:modelValue"] as (v: boolean) => void)(value);

const playOption = (option: QueueOption) => findItem(`queue_option.${option}`);

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
  it("is present for a container (album)", async () => {
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleItem()).toBeDefined();
  });

  it("is absent when the server does not support play_media shuffle", async () => {
    mockApi.supportsPlayMediaShuffle = false;
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleItem()).toBeUndefined();
  });

  it("is absent when there is no active player queue", async () => {
    mockStore.activePlayerQueue = undefined;
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleItem()).toBeUndefined();
  });

  it("is absent for a single track", async () => {
    await showPlayMenuForMediaItem(track({ item_id: "t1" }));
    expect(shuffleItem()).toBeUndefined();
  });

  it("is absent for spoken-word content that is meant to be heard in order", async () => {
    await showPlayMenuForMediaItem(podcast({ item_id: "pc1" }));
    expect(shuffleItem()).toBeUndefined();
  });

  it("is present for an artist", async () => {
    await showPlayMenuForMediaItem(artist({ item_id: "ar1" }));
    expect(shuffleItem()).toBeDefined();
  });

  it("is present for a genre", async () => {
    await showPlayMenuForMediaItem(genre({ item_id: "g1", is_playable: true }));
    expect(shuffleItem()).toBeDefined();
  });

  it("is present for a multi-item selection of non-container types", async () => {
    await showPlayMenuForMediaItem([
      track({ item_id: "t1" }),
      track({ item_id: "t2" }),
    ]);
    expect(shuffleItem()).toBeDefined();
  });

  it("is not offered by the item context menu", async () => {
    const items = await getPlaybackContextMenuItems([album({ item_id: "a1" })]);
    expect(items.find((x) => x.label === "shuffle")).toBeUndefined();
  });
});

describe("shuffle toggle state", () => {
  it("starts switched off even when the queue itself is shuffling", async () => {
    mockStore.activePlayerQueue = playerQueue({ shuffle_enabled: true });
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleSwitchOn()).toBe(false);
  });

  it("renders as its own switch row instead of a selectable menu item", async () => {
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    expect(shuffleItem()?.component).toBeDefined();
    expect(shuffleItem()?.action).toBeUndefined();
  });

  it("shows the switch as on once it has been flipped", async () => {
    await showPlayMenuForMediaItem(album({ item_id: "a1" }));
    flipShuffle(true);
    expect(shuffleSwitchOn()).toBe(true);
  });
});

describe("shuffle value passed to playMedia", () => {
  it("passes shuffle === undefined while the toggle has not been touched", async () => {
    const theAlbum = album({ item_id: "a1" });
    await showPlayMenuForMediaItem(theAlbum);
    playOption(QueueOption.PLAY)?.action?.();

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

  it("passes the flipped boolean after the toggle has been used", async () => {
    const theAlbum = album({ item_id: "a1" });
    await showPlayMenuForMediaItem(theAlbum);
    flipShuffle(true);
    playOption(QueueOption.PLAY)?.action?.();

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

  it("requests playing in order when the toggle is flipped back off", async () => {
    const theAlbum = album({ item_id: "a1" });
    await showPlayMenuForMediaItem(theAlbum);
    flipShuffle(true);
    flipShuffle(false);
    playOption(QueueOption.REPLACE)?.action?.();

    expect(mockApi.playMedia).toHaveBeenCalledWith(
      [theAlbum.uri],
      QueueOption.REPLACE,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );
  });

  it.each([QueueOption.NEXT, QueueOption.ADD, QueueOption.REPLACE_NEXT])(
    "omits shuffle for %s, which only stages items for later",
    async (option) => {
      const theAlbum = album({ item_id: "a1" });
      await showPlayMenuForMediaItem(theAlbum);
      flipShuffle(true);
      playOption(option)?.action?.();

      expect(mockApi.playMedia).toHaveBeenCalledWith(
        [theAlbum.uri],
        option,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    },
  );
});
