import { showContextMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import {
  MediaType,
  type ItemMapping,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { podcast } from "../fixtures/podcast";
import { providerMapping } from "../fixtures/providerMapping";

const { apiMock, emittedMenus, storeMock } = vi.hoisted(() => ({
  emittedMenus: [] as ContextMenuDialogEvent[],
  apiMock: {
    getItem: vi.fn(),
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
  item_id: "ep-1",
  provider: "gpodder--abc",
  name: "Episode 1",
  version: "",
  uri: "gpodder--abc://podcast_episode/ep-1",
  external_ids: [],
  is_playable: true,
  media_type: MediaType.PODCAST_EPISODE,
  available: true,
};

// the same episode as the lookup returns it: a different (library) identity,
// with the played state the menu needs
const resolved: PodcastEpisode = {
  item_id: "42",
  provider: "library",
  uri: "library://podcast_episode/42",
  name: "Episode 1",
  version: "",
  external_ids: [],
  is_playable: true,
  media_type: MediaType.PODCAST_EPISODE,
  provider_mappings: [providerMapping()],
  metadata: {},
  favorite: false,
  position: 1,
  podcast: podcast(),
  duration: 1800,
  fully_played: false,
  resume_position_ms: 120000,
};

beforeEach(() => {
  vi.clearAllMocks();
  emittedMenus.length = 0;
});

describe("showContextMenuForMediaItem hydration", () => {
  it("uses the looked-up detail but keeps the reference identity on actions", async () => {
    apiMock.getItem.mockResolvedValue(resolved);

    await showContextMenuForMediaItem(reference);

    // mark_unplayed is only offered because the lookup supplied the progress
    const markUnplayed = emittedMenus[0].items.find(
      (x) => x.label === "mark_unplayed",
    );
    expect(markUnplayed).toBeDefined();

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
