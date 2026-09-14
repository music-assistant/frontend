import type { MusicAssistantApi } from "@/plugins/api";
import type { Artist } from "@/plugins/api/interfaces";
import ArtistListing, { type Props } from "@/views/ArtistListing.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { artist } from "../fixtures/artist";

const { mockGetArtist } = vi.hoisted(() => ({
  mockGetArtist: vi.fn<MusicAssistantApi["getArtist"]>(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getArtist: mockGetArtist,
    getArtistAlbums: vi.fn().mockResolvedValue([]),
    providers: {},
  },
}));

// the source label is translated in the view's script, so the key is what the
// assertions read and they stay independent of en.json
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({}),
}));

// the stub renders path/itemtype so tests can read which preference key
// (see userPreferences.ts's getItemsListingPreferences) the listing was given
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: [
      "path",
      "itemtype",
      "subtitle",
      "loadItems",
      "requireProviderSelection",
      "libraryFilterOption",
      "defaultProvider",
    ],
    template:
      '<div class="items-listing-stub" :data-path="path" :data-itemtype="itemtype" />',
  },
}));

async function mountListing(listing: string, item: Artist = artist()) {
  mockGetArtist.mockResolvedValue(item);
  const wrapper = mount(ArtistListing, {
    // the route hands the view whatever string is in the url
    props: {
      itemId: item.item_id,
      provider: item.provider,
      listing: listing as Props["listing"],
    },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function listing(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "ItemsListing" });
}

function listingAttributes(wrapper: VueWrapper) {
  const listing = wrapper.find(".items-listing-stub");
  return {
    path: listing.attributes("data-path"),
    itemtype: listing.attributes("data-itemtype"),
  };
}

describe("ArtistListing", () => {
  beforeEach(() => {
    mockGetArtist.mockReset();
  });

  it.each([
    ["albums", "artistalbums", "artistalbums"],
    ["singles", "artistsingles", "artistalbums"],
    ["tracks", "artisttracks", "artisttracks"],
    ["appears_on", "artistappearson", "artistalbums"],
  ])("renders %s as its own listing", async (listing, path, itemtype) => {
    const wrapper = await mountListing(listing);
    expect(listingAttributes(wrapper)).toEqual({ path, itemtype });
  });

  it("renders nothing for an unknown listing", async () => {
    const wrapper = await mountListing("bogus");
    expect(wrapper.find(".items-listing-stub").exists()).toBe(false);
  });

  it.each(["albums", "singles"])(
    "lets %s be switched between the library and a provider",
    async (which) => {
      const props = listing(await mountListing(which)).props();

      expect(props.requireProviderSelection).toBe(true);
      expect(props.libraryFilterOption).toBe(true);
      // the row on the artist page is fed by the library, so the listing opens
      // on it too
      expect(props.defaultProvider).toBe("library");
    },
  );

  // a provider artist has nothing but its own catalog to show
  it("leaves a provider artist without a source selection", async () => {
    const props = listing(
      await mountListing("albums", artist({ provider: "spotify--abc" })),
    ).props();

    expect(props.requireProviderSelection).toBeUndefined();
    expect(props.libraryFilterOption).toBeUndefined();
  });

  it("names the source the releases were loaded from", async () => {
    const wrapper = await mountListing("albums");
    expect(listing(wrapper).props("subtitle")).toBe("Artist");

    await (
      listing(wrapper).props("loadItems") as (
        params: Record<string, unknown>,
      ) => Promise<unknown>
    )({ provider: ["library"] });
    await flushPromises();

    expect(listing(wrapper).props("subtitle")).toBe("Artist · source_library");
  });

  it("uses the same listing path for every artist", async () => {
    const wrapperA = await mountListing(
      "albums",
      artist({ item_id: "artist-a" }),
    );
    const wrapperB = await mountListing(
      "albums",
      artist({ item_id: "artist-b" }),
    );

    // the path must not embed the artist id, otherwise each artist gets its
    // own view mode/sort/filter preferences instead of sharing one
    expect(listingAttributes(wrapperA).path).not.toContain("artist-a");
    expect(listingAttributes(wrapperA).path).toBe(
      listingAttributes(wrapperB).path,
    );
  });
});
