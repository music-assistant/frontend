import type { TrackRowId } from "@/components/track/trackRows";
import { useTrackRowData } from "@/composables/useTrackRowData";
import type { Album, Track } from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";
import { album } from "../fixtures/album";
import { providerMapping } from "../fixtures/providerMapping";
import { track } from "../fixtures/track";

const {
  mockLoadTrackLyrics,
  mockLoadTrackAlbums,
  mockLoadTrackVersions,
  mockLoadSimilarTracks,
} = vi.hoisted(() => ({
  mockLoadTrackLyrics: vi.fn<(track: Track) => Promise<string | undefined>>(),
  mockLoadTrackAlbums: vi.fn<(track: Track) => Promise<Album[]>>(),
  mockLoadTrackVersions: vi.fn<(track: Track) => Promise<Track[]>>(),
  mockLoadSimilarTracks: vi.fn<(track: Track) => Promise<Track[]>>(),
}));

vi.mock("@/components/track/trackData", () => ({
  loadTrackLyrics: mockLoadTrackLyrics,
  loadTrackAlbums: mockLoadTrackAlbums,
  loadTrackVersions: mockLoadTrackVersions,
  loadSimilarTracks: mockLoadSimilarTracks,
}));

const scopes: EffectScope[] = [];

function libraryTrack(overrides: Partial<Track> = {}): Track {
  return track({
    item_id: "track-1",
    provider: "library",
    provider_mappings: [providerMapping({ provider_instance: "spotify--abc" })],
    ...overrides,
  });
}

/** The composable, with the rows the page shows and no track loaded yet. */
function setupRowData(options: { rows: TrackRowId[] }) {
  const trackRef = ref<Track>();
  const visibleRows = ref<TrackRowId[]>(options.rows);
  const scope = effectScope();
  scopes.push(scope);
  const rowData = scope.run(() => useTrackRowData(trackRef, visibleRows))!;
  return { track: trackRef, visibleRows, ...rowData };
}

type RowData = ReturnType<typeof setupRowData>;

/** Puts a track on the page, the way the view does once its details load. */
async function showTrack(page: RowData, item: Track) {
  page.track.value = item;
  await flushPromises();
}

function itemIds(items?: Array<{ item_id: string }>): string[] | undefined {
  return items?.map((item) => item.item_id);
}

describe("useTrackRowData", () => {
  beforeEach(() => {
    mockLoadTrackLyrics.mockReset().mockResolvedValue(undefined);
    mockLoadTrackAlbums.mockReset().mockResolvedValue([]);
    mockLoadTrackVersions.mockReset().mockResolvedValue([]);
    mockLoadSimilarTracks.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  it("loads what the visible rows need and nothing else", async () => {
    const page = setupRowData({ rows: ["lyrics", "other_versions"] });
    mockLoadTrackLyrics.mockResolvedValue("La la");
    mockLoadTrackVersions.mockResolvedValue([track({ item_id: "version-1" })]);

    await showTrack(page, libraryTrack());

    expect(page.lyrics.value).toEqual(["La la"]);
    expect(itemIds(page.versionItems.value)).toEqual(["version-1"]);
    expect(page.appearsOnItems.value).toBeUndefined();
    expect(page.similarItems.value).toBeUndefined();
    expect(mockLoadTrackAlbums).not.toHaveBeenCalled();
    expect(mockLoadSimilarTracks).not.toHaveBeenCalled();
  });

  it("requests a row unhidden later once, without re-requesting the others", async () => {
    const page = setupRowData({ rows: ["lyrics"] });
    await showTrack(page, libraryTrack());

    mockLoadTrackAlbums.mockResolvedValue([album({ item_id: "album-1" })]);
    page.visibleRows.value = ["lyrics", "appears_on"];
    await flushPromises();
    page.visibleRows.value = ["appears_on", "lyrics"];
    await flushPromises();

    expect(itemIds(page.appearsOnItems.value)).toEqual(["album-1"]);
    expect(mockLoadTrackAlbums).toHaveBeenCalledTimes(1);
    expect(mockLoadTrackLyrics).toHaveBeenCalledTimes(1);
  });

  it("starts over for a new track", async () => {
    const page = setupRowData({ rows: ["similar_tracks"] });
    mockLoadSimilarTracks.mockResolvedValue([track({ item_id: "similar-1" })]);
    await showTrack(page, libraryTrack());
    expect(itemIds(page.similarItems.value)).toEqual(["similar-1"]);

    mockLoadSimilarTracks.mockResolvedValue([track({ item_id: "similar-2" })]);
    page.track.value = libraryTrack({ item_id: "track-2" });
    await flushPromises();

    expect(mockLoadSimilarTracks).toHaveBeenCalledTimes(2);
    expect(mockLoadSimilarTracks).toHaveBeenLastCalledWith(
      expect.objectContaining({ item_id: "track-2" }),
    );
    expect(itemIds(page.similarItems.value)).toEqual(["similar-2"]);
  });

  it("drops a response that arrives after the track changed", async () => {
    const page = setupRowData({ rows: ["appears_on"] });
    let resolveFirst: (albums: Album[]) => void = () => {};
    mockLoadTrackAlbums.mockImplementationOnce(
      () =>
        new Promise<Album[]>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockLoadTrackAlbums.mockResolvedValue([album({ item_id: "second" })]);

    await showTrack(page, libraryTrack());
    expect(page.appearsOnItems.value).toBeUndefined();

    await showTrack(page, libraryTrack({ item_id: "track-2" }));
    resolveFirst([album({ item_id: "first" })]);
    await flushPromises();

    expect(itemIds(page.appearsOnItems.value)).toEqual(["second"]);
  });

  it("reports no lyrics as an empty row", async () => {
    const page = setupRowData({ rows: ["lyrics"] });

    await showTrack(page, libraryTrack());

    expect(page.lyrics.value).toEqual([]);
  });
});
