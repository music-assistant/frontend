import ItemsListing, {
  type LoadDataParams,
} from "@/components/ItemsListing.vue";
import LibraryArtists from "@/views/LibraryArtists.vue";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getLibraryArtists: vi.fn().mockResolvedValue([]),
    getLibraryArtistsCount: vi.fn().mockResolvedValue(12),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
// the page as it hands its loading and count to the listing
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["loadPagedData", "total"],
    template: "<div />",
  },
}));
vi.mock("@/composables/useLibrarySync", () => ({
  onLibrarySyncCompleted: () => () => {},
}));

const page = (offset: number): LoadDataParams => ({
  offset,
  limit: 50,
  sortBy: "name",
  search: "",
  favoritesOnly: true,
});

describe("LibraryArtists", () => {
  it("counts the artists for the first page and keeps that count while scrolling", async () => {
    const view = shallowMount(LibraryArtists, {
      global: { mocks: { $t: (key: string) => key } },
    });
    const listing = view.findComponent({ name: "ItemsListing" });
    const loadItems = listing.props("loadPagedData") as (
      params: LoadDataParams,
    ) => Promise<unknown>;

    await loadItems(page(0));
    await flushPromises();
    expect(listing.props("total")).toBe(12);

    await loadItems(page(50));
    expect(listing.props("total")).toBe(12);
    expect(apiMock.getLibraryArtistsCount).toHaveBeenCalledOnce();
  });
});
