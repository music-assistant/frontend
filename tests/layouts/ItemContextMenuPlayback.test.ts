import {
  getPlaybackContextMenuItems,
  showPlayMenuForMediaItem,
  type ContextMenuItem,
} from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { QueueOption } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { audioSource } from "../fixtures/audioSource";
import { providerMapping } from "../fixtures/providerMapping";
import { radio } from "../fixtures/radio";
import { track } from "../fixtures/track";

const { apiMock, emittedMenus, storeMock } = vi.hoisted(() => ({
  emittedMenus: [] as ContextMenuDialogEvent[],
  apiMock: {
    getCoreConfigValue: vi.fn(),
    playMedia: vi.fn(),
    providers: { "test_provider--1": { available: true } },
    players: {},
    supportsPlayMediaShuffle: true,
  },
  storeMock: {
    activePlayer: { player_id: "player-1" },
    activePlayerId: "player-1",
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((_type: string, payload: ContextMenuDialogEvent) => {
      emittedMenus.push(payload);
    }),
  },
}));

// an item only counts as available when one of its mappings resolves to a loaded provider
const mappings = [providerMapping()];

beforeEach(() => {
  vi.clearAllMocks();
  emittedMenus.length = 0;
  apiMock.getCoreConfigValue.mockResolvedValue(QueueOption.REPLACE);
});

describe("getPlaybackContextMenuItems", () => {
  it("offers a single play action for an audio source", async () => {
    const source = audioSource({ provider_mappings: mappings });

    const items = await getPlaybackContextMenuItems([source]);
    items[0].action?.();

    expect(items.map((x) => x.label)).toEqual(["play_now"]);
    expect(apiMock.playMedia).toHaveBeenCalledWith(
      [source.uri],
      QueueOption.REPLACE,
    );
  });

  it("keeps the queue for an audio source when the configured default does", async () => {
    apiMock.getCoreConfigValue.mockResolvedValue(QueueOption.PLAY);
    const source = audioSource({ provider_mappings: mappings });

    const items = await getPlaybackContextMenuItems([source]);
    items[0].action?.();

    expect(items.map((x) => x.label)).toEqual(["play_now"]);
    expect(apiMock.playMedia).toHaveBeenCalledWith(
      [source.uri],
      QueueOption.PLAY,
    );
  });

  it("keeps the enqueue options for radio, which shares the live sources default", async () => {
    const items = await getPlaybackContextMenuItems([
      radio({ provider_mappings: mappings }),
    ]);

    expect(items.find((x) => x.label == "enqueue")?.subItems).toHaveLength(5);
  });

  it("keeps the enqueue options for a track", async () => {
    const items = await getPlaybackContextMenuItems([
      track({ provider_mappings: mappings }),
    ]);

    expect(items.find((x) => x.label == "enqueue")?.subItems).toHaveLength(5);
  });
});

describe("showPlayMenuForMediaItem", () => {
  const emittedItems = (): ContextMenuItem[] => emittedMenus[0].items;

  it("offers a single play action for an audio source", async () => {
    await showPlayMenuForMediaItem(audioSource());

    expect(emittedItems().map((x) => x.label)).toEqual(["play_now"]);
  });

  it("offers every enqueue option for a track", async () => {
    await showPlayMenuForMediaItem(track());

    expect(emittedItems()).toHaveLength(5);
  });
});
