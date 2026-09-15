import type { MusicAssistantApi } from "@/plugins/api";
import type { Track } from "@/plugins/api/interfaces";
import TrackListing, { type Props } from "@/views/TrackListing.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../fixtures/track";

const { mockGetTrack } = vi.hoisted(() => ({
  mockGetTrack: vi.fn<MusicAssistantApi["getTrack"]>(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getTrack: mockGetTrack,
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
    props: ["path", "itemtype"],
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
