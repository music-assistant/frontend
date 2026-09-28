import { api, type MusicAssistantApi } from "@/plugins/api";
import {
  ProviderFeature,
  type Artist,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import ArtistListing, { type Props } from "@/views/ArtistListing.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { artist } from "../fixtures/artist";
import { providerMapping } from "../fixtures/providerMapping";

const { mockGetArtist, mockGetArtistDiscography, mockReplace, routeQuery } =
  vi.hoisted(() => ({
    mockGetArtist: vi.fn<MusicAssistantApi["getArtist"]>(),
    mockGetArtistDiscography:
      vi.fn<MusicAssistantApi["getArtistDiscography"]>(),
    mockReplace: vi.fn(),
    routeQuery: {} as Record<string, string>,
  }));

vi.mock("@/plugins/api", () => ({
  api: {
    getArtist: mockGetArtist,
    getArtistAlbums: vi.fn().mockResolvedValue([]),
    getArtistDiscography: mockGetArtistDiscography,
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
  useRouter: () => ({ replace: mockReplace }),
  useRoute: () => ({ query: routeQuery }),
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
      "providerOverride",
      "providerFilterOptions",
      "showProviderFilter",
      "sortKeys",
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
    mockReplace.mockReset();
    mockGetArtistDiscography.mockReset().mockResolvedValue([]);
    for (const key of Object.keys(api.providers)) delete api.providers[key];
    for (const key of Object.keys(routeQuery)) delete routeQuery[key];
  });

  it.each([
    ["albums", "artistalbums", "artistalbums"],
    ["singles", "artistsingles", "artistalbums"],
    ["tracks", "artisttracks", "artisttracks"],
    ["appears_on", "artistappearson", "artistalbums"],
    ["discography", "artistdiscography", "artistalbums"],
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
    expect(props.showProviderFilter).toBe(false);
  });

  // the row's picker on the artist page leaves out providers that cannot list
  // an artist's albums, and so does the listing
  it("offers the sources the row itself can be fed from", async () => {
    api.providers["spotify--abc"] = {
      instance_id: "spotify--abc",
      name: "Spotify",
      supported_features: [ProviderFeature.ARTIST_ALBUMS],
    } as ProviderInstance;
    api.providers["lyrics--1"] = {
      instance_id: "lyrics--1",
      name: "Lyrics",
      supported_features: [],
    } as unknown as ProviderInstance;

    const props = listing(
      await mountListing(
        "albums",
        artist({
          provider_mappings: [
            providerMapping({ provider_instance: "spotify--abc" }),
            providerMapping({ provider_instance: "lyrics--1" }),
          ],
        }),
      ),
    ).props();

    expect(props.providerFilterOptions).toEqual(["spotify--abc"]);
  });

  // the album page's "view all" can hand the albums listing the source its
  // shelf was showing, so the two line up
  it("opens on a source carried in by the route", async () => {
    api.providers["spotify--abc"] = {
      instance_id: "spotify--abc",
      name: "Spotify",
      supported_features: [ProviderFeature.ARTIST_ALBUMS],
    } as ProviderInstance;
    routeQuery.source = "spotify--abc";
    routeQuery.other = "kept";

    const props = listing(
      await mountListing(
        "albums",
        artist({
          provider_mappings: [
            providerMapping({ provider_instance: "spotify--abc" }),
          ],
        }),
      ),
    ).props();

    // the link's source is this visit's, over the saved filter; the row's own
    // source stays what the listing falls back to
    expect(props.providerOverride).toBe("spotify--abc");
    expect(props.defaultProvider).toBe("library");
    // a reload of, or a return to, this page must not carry it in again
    expect(mockReplace).toHaveBeenCalledWith({ query: { other: "kept" } });
  });

  it("ignores a carried source the listing does not offer", async () => {
    routeQuery.source = "tidal--gone";

    const props = listing(await mountListing("albums")).props();

    expect(props.providerOverride).toBeUndefined();
    expect(props.defaultProvider).toBe("library");
    expect(mockReplace).toHaveBeenCalledWith({ query: {} });
  });

  it("leaves the url alone when no source was carried in", async () => {
    await mountListing("albums");

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // the route reuses this view from one artist to the next, so every arrival
  // reads its own url
  it("takes a carried source per arrival", async () => {
    api.providers["spotify--abc"] = {
      instance_id: "spotify--abc",
      name: "Spotify",
      supported_features: [ProviderFeature.ARTIST_ALBUMS],
    } as ProviderInstance;
    const mapped = (item_id: string) =>
      artist({
        item_id,
        provider_mappings: [
          providerMapping({ provider_instance: "spotify--abc" }),
        ],
      });
    routeQuery.source = "spotify--abc";
    const wrapper = await mountListing("albums", mapped("artist-a"));
    expect(listing(wrapper).props("providerOverride")).toBe("spotify--abc");

    // the next artist's url names no source, so none is carried over
    delete routeQuery.source;
    mockGetArtist.mockResolvedValue(mapped("artist-b"));
    await wrapper.setProps({ itemId: "artist-b" });
    await flushPromises();
    expect(listing(wrapper).props("providerOverride")).toBeUndefined();

    routeQuery.source = "spotify--abc";
    mockGetArtist.mockResolvedValue(mapped("artist-c"));
    await wrapper.setProps({ itemId: "artist-c" });
    await flushPromises();
    expect(listing(wrapper).props("providerOverride")).toBe("spotify--abc");
    expect(mockReplace).toHaveBeenCalledTimes(2);
  });

  it("does not carry a consumed source over to another shelf and back", async () => {
    api.providers["spotify--abc"] = {
      instance_id: "spotify--abc",
      name: "Spotify",
      supported_features: [ProviderFeature.ARTIST_ALBUMS],
    } as ProviderInstance;
    routeQuery.source = "spotify--abc";
    const wrapper = await mountListing(
      "albums",
      artist({
        provider_mappings: [
          providerMapping({ provider_instance: "spotify--abc" }),
        ],
      }),
    );
    expect(listing(wrapper).props("providerOverride")).toBe("spotify--abc");

    delete routeQuery.source;
    await wrapper.setProps({ listing: "singles" });
    await wrapper.setProps({ listing: "albums" });
    await flushPromises();

    expect(listing(wrapper).props("providerOverride")).toBeUndefined();
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

  // a visit restored from the cache loads nothing, so the listing says which
  // source it is on
  it("names the source the listing says it is on", async () => {
    const wrapper = await mountListing("albums");

    listing(wrapper).vm.$emit("provider-change", ["library"]);
    await flushPromises();

    expect(listing(wrapper).props("subtitle")).toBe("Artist · source_library");
  });

  it("leaves the tracks header alone when the listing names a provider filter", async () => {
    const wrapper = await mountListing("tracks");

    listing(wrapper).vm.$emit("provider-change", ["library"]);
    await flushPromises();

    expect(listing(wrapper).props("subtitle")).toBe("Artist");
  });

  it("lists the artist's whole discography, in the order the server sent it", async () => {
    const wrapper = await mountListing(
      "discography",
      artist({ item_id: "artist-1" }),
    );

    await (
      listing(wrapper).props("loadItems") as (
        params: Record<string, unknown>,
      ) => Promise<unknown>
    )({});

    expect(mockGetArtistDiscography).toHaveBeenCalledWith("artist-1");
    expect((listing(wrapper).props("sortKeys") as string[])[0]).toBe(
      "original",
    );
  });

  // the discography is the library artist's, so there is nothing to switch to
  it("leaves the discography without a source selection", async () => {
    const props = listing(await mountListing("discography")).props();

    expect(props.showProviderFilter).toBe(false);
    expect(props.requireProviderSelection).toBeUndefined();
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
