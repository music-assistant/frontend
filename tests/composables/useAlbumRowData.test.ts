import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadAlbumVersions,
  mockLoadArtistReleases,
  mockEffectiveSource,
  mockResolveSource,
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
}));

vi.mock("@/components/album/albumData", () => ({
  loadAlbumVersions: mockLoadAlbumVersions,
  loadArtistReleases: mockLoadArtistReleases,
}));

// the effective source is the row registry's job (tested there); here it is
// mocked so the composable's per-source loading can be driven directly
vi.mock("@/components/album/albumRows", () => ({
  albumRows: {
    effectiveSource: mockEffectiveSource,
    resolveSource: mockResolveSource,
  },
}));

import type { AlbumRowId } from "@/components/album/albumRows";
import { useAlbumRowData } from "@/composables/useAlbumRowData";
import { api } from "@/plugins/api";
import {
  EventType,
  type Album,
  type EventMessage,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { effectScope, ref, type EffectScope } from "vue";
import { album } from "../fixtures/album";

const ALL_ROWS: AlbumRowId[] = ["tracks", "other_versions", "more_from_artist"];

const scopes: EffectScope[] = [];

/**
 * The composable, with the rows the page shows and no album loaded yet; the
 * album artist lookup has finished unless `artistSettled` says otherwise.
 */
function setupRowData(rows: AlbumRowId[] = ALL_ROWS, artistSettled = true) {
  const albumRef = ref<Album>();
  const visibleRows = ref<AlbumRowId[]>(rows);
  const settled = ref(artistSettled);
  const scope = effectScope();
  scopes.push(scope);
  const rowData = scope.run(() =>
    useAlbumRowData(albumRef, visibleRows, settled),
  )!;
  return { album: albumRef, visibleRows, artistSettled: settled, ...rowData };
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
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    vi.useRealTimers();
    vi.restoreAllMocks();
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

    it("keeps loading an empty library until the artist lookup has finished", async () => {
      const page = setupRowData(ALL_ROWS, false);
      await showAlbum(page);

      expect(mockLoadArtistReleases).toHaveBeenCalledTimes(1);
      expect(page.moreFromArtistSource.value).toBeUndefined();
      expect(page.artistReleaseItems.value).toBeUndefined();
      expect(page.moreFromArtistSourceDisplay.value).toEqual({
        label: "Automatic",
      });

      // found or not, the finished lookup settles the row
      page.artistSettled.value = true;
      await flushPromises();

      expect(mockResolveSource).toHaveBeenLastCalledWith(
        "more_from_artist",
        expect.anything(),
        false,
      );
      expect(page.moreFromArtistSource.value).toBe("spotify--abc");
      expect(page.artistReleaseItems.value).toEqual([
        album({ item_id: "spotify-release" }),
      ]);
    });

    it("comes back to the library once a library change adds a release", async () => {
      vi.useFakeTimers();
      let onLibraryChange: (evt: EventMessage) => void = () => {};
      vi.spyOn(api, "subscribe_multi").mockImplementation((_events, cb) => {
        onLibraryChange = cb as (evt: EventMessage) => void;
        return () => {};
      });
      const page = setupRowData();
      await showAlbum(page);
      expect(page.moreFromArtistSource.value).toBe("spotify--abc");

      mockLoadArtistReleases.mockImplementation(async () => [
        album({ item_id: "added" }),
      ]);
      onLibraryChange({
        event: EventType.MEDIA_ITEM_ADDED,
        data: album({ item_id: "added" }),
      } as EventMessage);
      await vi.runAllTimersAsync();

      expect(page.moreFromArtistSource.value).toBe("library");
      expect(page.artistReleaseItems.value).toEqual([
        album({ item_id: "added" }),
      ]);
    });
  });
});
