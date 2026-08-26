import { showContextMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import {
  MediaType,
  type Audiobook,
  type ItemMapping,
} from "@/plugins/api/interfaces";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerMapping } from "../fixtures/providerMapping";

const { apiMock, emittedMenus, storeMock } = vi.hoisted(() => ({
  emittedMenus: [] as ContextMenuDialogEvent[],
  apiMock: {
    getItem: vi.fn(),
    getLibraryItem: vi.fn(),
    getProvider: vi.fn(),
    getCoreConfigValue: vi.fn(),
    markItemPlayed: vi.fn(),
    markItemUnPlayed: vi.fn(),
    playMedia: vi.fn(),
    providers: {},
    players: {},
  },
  storeMock: {
    activePlayer: undefined,
    activePlayerId: undefined,
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

// the lightweight reference a discover row card holds: provider identity, no
// provider mappings and no played state
const reference: ItemMapping = {
  item_id: "book-1",
  provider: "audiobookshelf--abc",
  name: "Book 1",
  version: "",
  uri: "audiobookshelf--abc://audiobook/book-1",
  external_ids: [],
  is_playable: true,
  media_type: MediaType.AUDIOBOOK,
  available: true,
};

// the same audiobook as the lookup returns it: a different (library) identity,
// favorited, with the played state the menu needs
const resolved: Audiobook = {
  item_id: "42",
  provider: "library",
  uri: "library://audiobook/42",
  name: "Book 1",
  version: "",
  external_ids: [],
  is_playable: true,
  media_type: MediaType.AUDIOBOOK,
  provider_mappings: [providerMapping({ in_library: true })],
  metadata: {},
  favorite: true,
  publisher: null,
  authors: [],
  narrators: [],
  duration: 1800,
  fully_played: false,
  resume_position_ms: 120000,
};

beforeEach(() => {
  vi.clearAllMocks();
  emittedMenus.length = 0;
});

describe("showContextMenuForMediaItem hydration", () => {
  it("uses the looked-up play state but keeps the reference identity", async () => {
    apiMock.getItem.mockResolvedValue(resolved);

    await showContextMenuForMediaItem(reference);

    // mark_unplayed is only offered because the lookup supplied the progress
    const labels = emittedMenus[0].items.map((x) => x.label);
    const markUnplayed = emittedMenus[0].items.find(
      (x) => x.label === "mark_unplayed",
    );
    expect(markUnplayed).toBeDefined();
    // id-based actions must not leak in from the resolved item: their commands
    // take a library id, which the reference identity is not
    expect(labels).not.toContain("favorites_remove");
    expect(labels).not.toContain("remove_library");

    // the playlog is keyed by the identity the card holds, not the resolved one
    await markUnplayed?.action?.();
    expect(apiMock.markItemUnPlayed).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: reference.item_id,
        provider: reference.provider,
        uri: reference.uri,
      }),
    );
  });

  it("still opens the menu when the lookup fails", async () => {
    apiMock.getItem.mockRejectedValue(new Error("provider unavailable"));

    await showContextMenuForMediaItem(reference);

    expect(emittedMenus).toHaveLength(1);
    const labels = emittedMenus[0].items.map((x) => x.label);
    // without played state the menu falls back to the reference's own actions
    expect(labels).toContain("mark_played");
    expect(labels).not.toContain("mark_unplayed");
  });
});
