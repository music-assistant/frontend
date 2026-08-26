import ArtistDetails from "@/views/ArtistDetails.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { ArtistType, type Artist } from "@/plugins/api/interfaces";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { artist } from "../fixtures/artist";

const { mockGetArtist, mockSubscribe } = vi.hoisted(() => ({
  mockGetArtist: vi.fn<MusicAssistantApi["getArtist"]>(),
  mockSubscribe: vi.fn(() => () => {}),
}));

vi.mock("@/plugins/api", () => ({
  api: { getArtist: mockGetArtist, subscribe: mockSubscribe, providers: {} },
}));

vi.mock("@/components/InfoHeader.vue", () => ({
  default: { name: "InfoHeader", template: "<div />" },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: { name: "ProviderDetails", template: "<div />" },
}));
vi.mock("@/components/MediaItemImages.vue", () => ({
  default: { name: "MediaItemImages", template: "<div />" },
}));
// the stub renders path/itemtype so tests can read which preference key
// (see userPreferences.ts's getItemsListingPreferences) each row was given
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["path", "itemtype"],
    template:
      '<div class="items-listing-stub" :data-path="path" :data-itemtype="itemtype" />',
  },
}));

async function mountDetails(item: Artist) {
  mockGetArtist.mockResolvedValue(item);
  const wrapper = mount(ArtistDetails, {
    props: { itemId: item.item_id, provider: item.provider },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

// resolves the persisted-preferences path for the listing row of the given
// itemtype (there is at most one such row per artist in these fixtures)
function pathFor(wrapper: VueWrapper, itemtype: string) {
  return wrapper.find(`[data-itemtype="${itemtype}"]`).attributes("data-path");
}

describe("ArtistDetails", () => {
  beforeEach(() => {
    mockGetArtist.mockReset();
    mockSubscribe.mockReset().mockReturnValue(() => {});
  });

  it("uses the same albums/tracks listing path for every library artist", async () => {
    const wrapperA = await mountDetails(
      artist({ item_id: "artist-a", provider: "library" }),
    );
    const wrapperB = await mountDetails(
      artist({ item_id: "artist-b", provider: "library" }),
    );

    const albumsPathA = pathFor(wrapperA, "artistalbums");
    const tracksPathA = pathFor(wrapperA, "artisttracks");

    // the path must not embed the artist id, otherwise each artist gets its
    // own view mode/sort/filter preferences instead of sharing one
    expect(albumsPathA).not.toContain("artist-a");
    expect(tracksPathA).not.toContain("artist-a");
    expect(albumsPathA).toBe(pathFor(wrapperB, "artistalbums"));
    expect(tracksPathA).toBe(pathFor(wrapperB, "artisttracks"));
  });

  it("uses the same audiobooks listing path for every library author/narrator artist", async () => {
    const wrapperA = await mountDetails(
      artist({
        item_id: "author-a",
        provider: "library",
        artist_type: ArtistType.AUTHOR,
      }),
    );
    const wrapperB = await mountDetails(
      artist({
        item_id: "author-b",
        provider: "library",
        artist_type: ArtistType.AUTHOR,
      }),
    );

    const audiobooksPathA = pathFor(wrapperA, "artistaudiobooks");

    expect(audiobooksPathA).not.toContain("author-a");
    expect(audiobooksPathA).toBe(pathFor(wrapperB, "artistaudiobooks"));
  });
});
