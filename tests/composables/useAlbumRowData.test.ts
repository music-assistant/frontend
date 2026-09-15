import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoadAlbumVersions, mockLoadArtistReleases } = vi.hoisted(() => ({
  mockLoadAlbumVersions: vi.fn(),
  mockLoadArtistReleases: vi.fn(),
}));

vi.mock("@/components/album/albumData", () => ({
  loadAlbumVersions: mockLoadAlbumVersions,
  loadArtistReleases: mockLoadArtistReleases,
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
    expect(page.artistReleases.value).toHaveLength(1);
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

    expect(page.artistReleases.value).toEqual([]);
  });
});
