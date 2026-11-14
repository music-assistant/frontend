import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadAlbumVersions,
  mockLoadArtistReleases,
  mockEffectiveSource,
  mockResolveSource,
  mockSourcesKnown,
} = vi.hoisted(() => ({
  mockLoadAlbumVersions: vi.fn(),
  mockLoadArtistReleases: vi.fn(),
  mockEffectiveSource: vi.fn(() => "library" as string),
  mockResolveSource:
    vi.fn<
      (
        id: string,
        item: unknown,
        libraryHasItems?: boolean,
      ) => string | undefined
    >(),
  mockSourcesKnown: vi.fn(() => true),
}));

vi.mock("@/components/album/albumData", () => ({
  loadAlbumVersions: mockLoadAlbumVersions,
  loadArtistReleases: mockLoadArtistReleases,
}));

// the effective source is the row registry's job (tested there); here it is
// mocked so the composable's per-source loading can be driven directly
vi.mock("@/components/album/albumRows", () => ({
  albumArtistSourcesKnown: mockSourcesKnown,
  albumRows: {
    effectiveSource: mockEffectiveSource,
    resolveSource: mockResolveSource,
  },
}));

import type { AlbumRowId } from "@/components/album/albumRows";
import { useAlbumRowData } from "@/composables/useAlbumRowData";
import type { Album } from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { effectScope, ref, type EffectScope } from "vue";
import { album } from "../fixtures/album";

const ALL_ROWS: AlbumRowId[] = ["tracks", "other_versions", "more_from_artist"];

const scopes: EffectScope[] = [];

/** The composable, with the rows the page shows and no album loaded yet. */
function setupRowData(rows: AlbumRowId[] = ALL_ROWS) {
  const albumRef = ref<Album>();
  const visibleRows = ref<AlbumRowId[]>(rows);
  const scope = effectScope();
  scopes.push(scope);
  const rowData = scope.run(() => useAlbumRowData(albumRef, visibleRows))!;
  return { album: albumRef, visibleRows, ...rowData };
}

/** Puts an album on the page, the way the view does once its details load. */
async function showAlbum(
  page: ReturnType<typeof setupRowData>,
  item: Album = album({ item_id: "1" }),
) {
  page.album.value = item;
  await flushPromises();
}

describe("useAlbumRowData", () => {
  beforeEach(() => {
    mockLoadAlbumVersions.mockReset();
    mockLoadAlbumVersions.mockResolvedValue([album({ item_id: "2" })]);
    mockLoadArtistReleases.mockReset();
    mockLoadArtistReleases.mockResolvedValue([album({ item_id: "3" })]);
    mockEffectiveSource.mockReset().mockReturnValue("library");
    // a saved source is resolved as it is
    mockResolveSource
      .mockReset()
      .mockImplementation(() => mockEffectiveSource());
    mockSourcesKnown.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  it("loads only what the visible rows need", async () => {
    const page = setupRowData(["tracks"]);
    await showAlbum(page);

    expect(mockLoadAlbumVersions).not.toHaveBeenCalled();
    expect(mockLoadArtistReleases).not.toHaveBeenCalled();

    page.visibleRows.value = ALL_ROWS;
    await flushPromises();

    expect(page.versionItems.value).toHaveLength(1);
    expect(page.artistReleaseItems.value).toHaveLength(1);
  });

  it("loads the artist releases from the effective source", async () => {
    mockEffectiveSource.mockReturnValue("spotify--abc");
    const page = setupRowData();
    await showAlbum(page);

    expect(mockLoadArtistReleases).toHaveBeenLastCalledWith(
      expect.anything(),
      "spotify--abc",
    );
    expect(page.moreFromArtistSource.value).toBe("spotify--abc");
    expect(page.artistReleaseItems.value).toHaveLength(1);
  });

  it("loads a new source on switch and reuses the first on return", async () => {
    // a reactive source, so the composable's watcher fires when it changes
    const source = ref("library");
    mockEffectiveSource.mockImplementation(() => source.value);
    mockLoadArtistReleases.mockImplementation(async (_album, from) => [
      album({ item_id: from as string }),
    ]);

    const page = setupRowData();
    await showAlbum(page);
    expect(page.artistReleaseItems.value).toEqual([
      album({ item_id: "library" }),
    ]);

    source.value = "spotify--abc";
    await flushPromises();
    expect(mockLoadArtistReleases).toHaveBeenLastCalledWith(
      expect.anything(),
      "spotify--abc",
    );
    expect(page.artistReleaseItems.value).toEqual([
      album({ item_id: "spotify--abc" }),
    ]);

    // switching back serves the first load from the cache, without re-fetching
    const calls = mockLoadArtistReleases.mock.calls.length;
    source.value = "library";
    await flushPromises();
    expect(mockLoadArtistReleases).toHaveBeenCalledTimes(calls);
    expect(page.artistReleaseItems.value).toEqual([
      album({ item_id: "library" }),
    ]);
  });

  it("asks for each row once, however often the rows are resolved again", async () => {
    const page = setupRowData();
    await showAlbum(page);
    page.visibleRows.value = [...ALL_ROWS];
    await flushPromises();

    expect(mockLoadAlbumVersions).toHaveBeenCalledTimes(1);
    expect(mockLoadArtistReleases).toHaveBeenCalledTimes(1);
  });

  it("starts over on another album", async () => {
    const page = setupRowData();
    await showAlbum(page);
    expect(page.versionItems.value).toHaveLength(1);

    mockLoadAlbumVersions.mockResolvedValue([]);
    await showAlbum(page, album({ item_id: "9" }));

    expect(mockLoadAlbumVersions).toHaveBeenCalledTimes(2);
    expect(page.versionItems.value).toEqual([]);
  });

  // a provider that fails must not blank the page
  it("leaves a row that failed empty", async () => {
    mockLoadArtistReleases.mockRejectedValue(new Error("nope"));
    const page = setupRowData();
    await showAlbum(page);

    expect(page.artistReleaseItems.value).toEqual([]);
  });

  describe("an automatic source", () => {
    beforeEach(() => {
      mockEffectiveSource.mockReturnValue("auto");
      // the registry's resolution, with a provider to turn to
      mockResolveSource.mockImplementation((_id, _item, libraryHasItems) =>
        libraryHasItems === undefined
          ? undefined
          : libraryHasItems
            ? "library"
            : "spotify--abc",
      );
      mockLoadArtistReleases.mockImplementation(async (_album, from) =>
        from === "library" ? [] : [album({ item_id: "spotify-release" })],
      );
    });

    it("shows the library when it holds other releases", async () => {
      mockLoadArtistReleases.mockResolvedValue([album({ item_id: "3" })]);
      const page = setupRowData();
      await showAlbum(page);

      expect(mockLoadArtistReleases).toHaveBeenCalledTimes(1);
      expect(page.moreFromArtistSource.value).toBe("library");
      expect(page.moreFromArtistSelectedSource.value).toBe("auto");
    });

    it("turns to the provider when the library holds no other release", async () => {
      const page = setupRowData();
      await showAlbum(page);

      expect(mockLoadArtistReleases.mock.calls.map(([, from]) => from)).toEqual(
        ["library", "spotify--abc"],
      );
      expect(page.moreFromArtistSource.value).toBe("spotify--abc");
      expect(page.artistReleaseItems.value).toEqual([
        album({ item_id: "spotify-release" }),
      ]);
    });

    it("keeps loading an empty library until the artist's providers are known", async () => {
      mockSourcesKnown.mockReturnValue(false);
      const page = setupRowData();
      await showAlbum(page);

      expect(mockLoadArtistReleases).toHaveBeenCalledTimes(1);
      expect(page.moreFromArtistSource.value).toBeUndefined();
      expect(page.artistReleaseItems.value).toBeUndefined();
      expect(page.moreFromArtistSourceDisplay.value).toEqual({
        label: "Automatic",
      });

      // the full artist arrives in artists[0]
      mockSourcesKnown.mockReturnValue(true);
      page.album.value = { ...page.album.value! };
      await flushPromises();

      expect(page.moreFromArtistSource.value).toBe("spotify--abc");
      expect(page.artistReleaseItems.value).toEqual([
        album({ item_id: "spotify-release" }),
      ]);
    });
  });
});
