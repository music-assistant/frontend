import type { MusicAssistantApi } from "@/plugins/api";
import type { LoadDataParams } from "@/composables/useItemsListing";
import {
  ListingType,
  SortDirection,
  SortField,
  type Track,
} from "@/plugins/api/interfaces";
import TrackListing, { type Props } from "@/views/TrackListing.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../fixtures/track";
import { providerMapping } from "../fixtures/providerMapping";

const { mockGetTrack, mockGetSimilarTracks } = vi.hoisted(() => ({
  mockGetTrack: vi.fn<MusicAssistantApi["getTrack"]>(),
  mockGetSimilarTracks: vi.fn<MusicAssistantApi["getSimilarTracks"]>(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getTrack: mockGetTrack,
    getSimilarTracks: mockGetSimilarTracks,
    providers: {},
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({}),
}));

// the stub renders path/itemtype so tests can read which preference key
// (see userPreferences.ts's getItemsListingPreferences) the listing was given
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["path", "itemtype", "loadPagedData", "sortListing"],
    template:
      '<div class="items-listing-stub" :data-path="path" :data-itemtype="itemtype" />',
  },
}));

async function mountListing(
  listing: string,
  item: Track = track(),
  albumUri?: string,
) {
  mockGetTrack.mockResolvedValue(item);
  const wrapper = mount(TrackListing, {
    // the route hands the view whatever string is in the url
    props: {
      itemId: item.item_id,
      provider: item.provider,
      listing: listing as Props["listing"],
      album: albumUri,
    },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function listingAttributes(wrapper: VueWrapper) {
  const listing = wrapper.find(".items-listing-stub");
  return {
    path: listing.attributes("data-path"),
    itemtype: listing.attributes("data-itemtype"),
  };
}

describe("TrackListing", () => {
  beforeEach(() => {
    mockGetTrack.mockReset();
    mockGetSimilarTracks.mockReset().mockResolvedValue([]);
  });

  it("renders the similar tracks as their own listing", async () => {
    const wrapper = await mountListing(
      "similar",
      track({ item_id: "7", provider: "spotify--abc" }),
    );
    expect(mockGetTrack).toHaveBeenCalledWith("7", "spotify--abc", undefined);
    expect(listingAttributes(wrapper)).toEqual({
      path: "tracksimilar",
      itemtype: "similartracks",
    });
    expect(
      wrapper.findComponent({ name: "ItemsListing" }).props("sortListing"),
    ).toBe(ListingType.SIMILAR_TRACKS);
  });

  it("pages similar tracks and advances past hidden mapping matches", async () => {
    const sharedMapping = providerMapping({
      item_id: "shared-track-id",
      provider_domain: "spotify",
      provider_instance: "spotify--abc",
    });
    const current = track({
      item_id: "7",
      provider: "spotify--abc",
      provider_mappings: [sharedMapping],
    });
    const selfMatch = track({
      item_id: "same-recording",
      provider: current.provider,
      provider_mappings: [sharedMapping],
    });
    const firstVisible = track({ item_id: "similar-a", provider_mappings: [] });
    const secondVisible = track({
      item_id: "similar-b",
      provider_mappings: [],
    });
    mockGetSimilarTracks
      .mockResolvedValueOnce([selfMatch, firstVisible])
      .mockResolvedValueOnce([secondVisible]);
    const wrapper = await mountListing("similar", current);
    const loadPagedData = wrapper
      .findComponent({ name: "ItemsListing" })
      .props("loadPagedData") as (params: LoadDataParams) => Promise<Track[]>;
    const params: LoadDataParams = {
      offset: 0,
      limit: 2,
      sortBy: "name:asc",
      sortField: SortField.NAME,
      sortDirection: SortDirection.ASC,
      search: "live",
    };

    await expect(loadPagedData(params)).resolves.toEqual([firstVisible]);
    await expect(loadPagedData({ ...params, offset: 1 })).resolves.toEqual([
      secondVisible,
    ]);

    expect(mockGetSimilarTracks).toHaveBeenNthCalledWith(
      1,
      current.item_id,
      current.provider,
      2,
      "live",
      0,
      SortField.NAME,
      SortDirection.ASC,
    );
    expect(mockGetSimilarTracks).toHaveBeenNthCalledWith(
      2,
      current.item_id,
      current.provider,
      2,
      "live",
      2,
      SortField.NAME,
      SortDirection.ASC,
    );
  });

  it("asks for the track on the album it was opened from", async () => {
    await mountListing(
      "similar",
      track({ item_id: "7", provider: "spotify--abc" }),
      "library://album/3",
    );
    expect(mockGetTrack).toHaveBeenCalledWith(
      "7",
      "spotify--abc",
      "library://album/3",
    );
  });

  it("renders nothing for an unknown listing", async () => {
    const wrapper = await mountListing("bogus");
    expect(wrapper.find(".items-listing-stub").exists()).toBe(false);
  });

  it("uses the same listing path for every track", async () => {
    const wrapperA = await mountListing(
      "similar",
      track({ item_id: "track-a" }),
    );
    const wrapperB = await mountListing(
      "similar",
      track({ item_id: "track-b" }),
    );

    // the path must not embed the track id, otherwise each track gets its
    // own view mode/sort/filter preferences instead of sharing one
    expect(listingAttributes(wrapperA).path).not.toContain("track-a");
    expect(listingAttributes(wrapperA).path).toBe(
      listingAttributes(wrapperB).path,
    );
  });
});
