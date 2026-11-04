import type { LoadDataParams } from "@/composables/useItemsListing";
import {
  useListingFilters,
  type ListingFilterActions,
} from "@/composables/useListingFilters";
import type { ListingMultiFilter } from "@/helpers/listing_filters";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const actions: ListingFilterActions = {
  toggleFavorites: vi.fn(),
  toggleAlbumArtists: vi.fn(),
  toggleLibraryOnly: vi.fn(),
  toggleHideFullyPlayed: vi.fn(),
  toggleCollapseCollections: vi.fn(),
  setHideEmpty: vi.fn(),
  toggleGenre: vi.fn(),
  setGenres: vi.fn(),
  toggleAlbumType: vi.fn(),
  setAlbumTypes: vi.fn(),
  toggleProvider: vi.fn(),
};

function genreFilter(
  genreIds: LoadDataParams["genreIds"],
  genreOptions: { label: string; value: number }[],
) {
  const filters = useListingFilters(
    { showGenreFilter: true },
    {
      params: ref<LoadDataParams>({
        offset: 0,
        limit: 50,
        sortBy: "name",
        search: "",
        genreIds,
      }),
      genreOptions: ref(genreOptions),
      providerOptions: ref([]),
    },
    actions,
  );
  return filters.value.find((filter) => filter.id === "genre") as
    ListingMultiFilter | undefined;
}

describe("useListingFilters", () => {
  it("offers the genre filter once there are genres to pick", () => {
    expect(genreFilter(undefined, [])).toBeUndefined();
    expect(genreFilter(undefined, [{ label: "Jazz", value: 3 }])).toBeDefined();
  });

  it("keeps a genre picked by a link while the genres have not loaded", () => {
    const filter = genreFilter([7], []);

    expect(filter?.selected).toEqual(["7"]);
    expect(filter?.options).toEqual([{ label: "7", value: "7" }]);
  });

  it("names a picked genre once the genres are there", () => {
    const filter = genreFilter(3, [
      { label: "Jazz", value: 3 },
      { label: "Rock", value: 4 },
    ]);

    expect(filter?.selected).toEqual(["3"]);
    expect(filter?.options.map((option) => option.label)).toEqual([
      "Jazz",
      "Rock",
    ]);
  });
});
