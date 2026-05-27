import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSetupDebouncedSearch } = vi.hoisted(() => ({
  mockSetupDebouncedSearch: vi.fn(),
}));

vi.mock("@/composables/useSmartPlaylistSearchHelpers", () => ({
  setupDebouncedSearch: mockSetupDebouncedSearch,
}));

vi.mock("@/plugins/api", () => ({
  default: {
    getLibraryArtists: vi.fn(),
    getLibraryAlbums: vi.fn(),
  },
}));

import { useSmartPlaylistContentFilters } from "@/composables/useSmartPlaylistContentFilters";

describe("useSmartPlaylistContentFilters", () => {
  beforeEach(() => {
    mockSetupDebouncedSearch.mockClear();
  });

  it("registers all four debounced searches", () => {
    const artistIds = ref<number[] | undefined>([]);
    const albumIds = ref<number[] | undefined>([]);
    const excludedArtistIds = ref<number[] | undefined>([]);
    const excludedAlbumIds = ref<number[] | undefined>([]);

    useSmartPlaylistContentFilters(
      artistIds,
      albumIds,
      excludedArtistIds,
      excludedAlbumIds,
    );

    expect(mockSetupDebouncedSearch).toHaveBeenCalledTimes(4);
  });

  it("moves artist from excluded list to included list", () => {
    const artistIds = ref<number[] | undefined>([]);
    const albumIds = ref<number[] | undefined>([]);
    const excludedArtistIds = ref<number[] | undefined>([5]);
    const excludedAlbumIds = ref<number[] | undefined>([]);

    const filters = useSmartPlaylistContentFilters(
      artistIds,
      albumIds,
      excludedArtistIds,
      excludedAlbumIds,
    );

    filters.selectedExcludedArtistItems.value = [{ id: 5, name: "A" }];

    filters.toggleArtistById(5, "Artist 5");

    expect(artistIds.value).toEqual([5]);
    expect(excludedArtistIds.value).toEqual([]);
    expect(filters.selectedArtistItems.value).toEqual([
      { id: 5, name: "Artist 5" },
    ]);
    expect(filters.selectedExcludedArtistItems.value).toEqual([]);
  });

  it("moves album from included list to excluded list", () => {
    const artistIds = ref<number[] | undefined>([]);
    const albumIds = ref<number[] | undefined>([7]);
    const excludedArtistIds = ref<number[] | undefined>([]);
    const excludedAlbumIds = ref<number[] | undefined>([]);

    const filters = useSmartPlaylistContentFilters(
      artistIds,
      albumIds,
      excludedArtistIds,
      excludedAlbumIds,
    );

    filters.selectedAlbumItems.value = [{ id: 7, name: "Album 7" }];

    filters.toggleExcludedAlbumById(7, "Album 7");

    expect(albumIds.value).toEqual([]);
    expect(excludedAlbumIds.value).toEqual([7]);
    expect(filters.selectedAlbumItems.value).toEqual([]);
    expect(filters.selectedExcludedAlbumItems.value).toEqual([
      { id: 7, name: "Album 7" },
    ]);
  });

  it("updates rule ids through model setters", () => {
    const artistIds = ref<number[] | undefined>([1, 2]);
    const albumIds = ref<number[] | undefined>([10, 20]);
    const excludedArtistIds = ref<number[] | undefined>([3]);
    const excludedAlbumIds = ref<number[] | undefined>([30]);

    const filters = useSmartPlaylistContentFilters(
      artistIds,
      albumIds,
      excludedArtistIds,
      excludedAlbumIds,
    );

    filters.selectedArtistItems.value = [
      { id: 1, name: "A1" },
      { id: 2, name: "A2" },
    ];
    filters.selectedAlbumItems.value = [
      { id: 10, name: "AL10" },
      { id: 20, name: "AL20" },
    ];

    filters.artistModelValue.value = ["2"];
    filters.albumModelValue.value = ["10"];

    expect(artistIds.value).toEqual([2]);
    expect(albumIds.value).toEqual([10]);
  });
});
