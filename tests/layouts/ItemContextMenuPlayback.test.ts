import {
  getPlaybackContextMenuItems,
  showPlayMenuForMediaItem,
  type ContextMenuItem,
} from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { QueueOption } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { audioSource } from "../fixtures/audioSource";
import { providerMapping } from "../fixtures/providerMapping";
import { radio } from "../fixtures/radio";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
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
// signed in as a member unless a test says otherwise
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../fixtures/scopes");
  return {
    authManager: { hasScope: vi.fn(scopeChecker(BUILTIN_ROLE_SCOPES.user)) },
  };
});
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
  vi.mocked(authManager.hasScope).mockImplementation(
    scopeChecker(BUILTIN_ROLE_SCOPES.user),
  );
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

describe("the play menu for a role that may not read the core settings", () => {
  beforeEach(() => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );
  });

  it("starts an audio source the server's default way without asking it", async () => {
    const source = audioSource({ provider_mappings: mappings });

    const items = await getPlaybackContextMenuItems([source]);
    items[0].action?.();

    expect(apiMock.getCoreConfigValue).not.toHaveBeenCalled();
    expect(apiMock.playMedia).toHaveBeenCalledWith([source.uri], undefined);
  });

  it("plays a track now the server's default way without asking it", async () => {
    const item = track({ provider_mappings: mappings });

    const items = await getPlaybackContextMenuItems([item]);
    items.find((x) => x.label == "play_now")?.action?.();

    expect(apiMock.getCoreConfigValue).not.toHaveBeenCalled();
    expect(apiMock.playMedia).toHaveBeenCalledWith([item.uri], undefined);
  });

  it.each([
    { item: track({ provider_mappings: mappings }) },
    { item: radio({ provider_mappings: mappings }) },
  ])(
    "marks none of the enqueue options for a $item.media_type",
    async ({ item }) => {
      const items = await getPlaybackContextMenuItems([item]);
      const options = items.find((x) => x.label == "enqueue")?.subItems ?? [];

      expect(apiMock.getCoreConfigValue).not.toHaveBeenCalled();
      expect(options).toHaveLength(5);
      expect(options.some((x) => x.selected)).toBe(false);
    },
  );
});
