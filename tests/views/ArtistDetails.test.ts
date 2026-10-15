import type { MusicAssistantApi } from "@/plugins/api";
import {
  AlbumType,
  ArtistType,
  ListingType,
  SortDirection,
  SortField,
  type Artist,
  type Album,
} from "@/plugins/api/interfaces";
import type { LoadDataParams } from "@/components/ItemsListing.vue";
import ArtistDetails from "@/views/ArtistDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { track } from "../fixtures/track";
import { providerMapping } from "../fixtures/providerMapping";

const {
  mockGetArtist,
  mockGetArtistAudiobooks,
  mockSubscribe,
  mockAvailableArtistRowIds,
  mockResolveArtistRows,
  mockArtistRowSources,
  mockLoadArtistReleases,
  mockLoadArtistDiscography,
  mockLoadArtistTracks,
  mockLoadArtistTopTracks,
  mockLoadSimilarArtists,
  mockLoadArtistAppearsOn,
} = vi.hoisted(() => ({
  mockGetArtist: vi.fn<MusicAssistantApi["getArtist"]>(),
  mockGetArtistAudiobooks: vi.fn<MusicAssistantApi["getArtistAudiobooks"]>(),
  mockSubscribe: vi.fn(() => () => {}),
  mockAvailableArtistRowIds: vi.fn(),
  mockResolveArtistRows: vi.fn(),
  mockArtistRowSources: vi.fn(),
  mockLoadArtistReleases: vi.fn(),
  mockLoadArtistDiscography: vi.fn(),
  mockLoadArtistTracks: vi.fn(),
  mockLoadArtistTopTracks: vi.fn(),
  mockLoadSimilarArtists: vi.fn(),
  mockLoadArtistAppearsOn: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getArtist: mockGetArtist,
    getArtistAudiobooks: mockGetArtistAudiobooks,
    subscribe: mockSubscribe,
    subscribe_multi: mockSubscribe,
    providers: {},
    getProvider: () => undefined,
  },
}));

// row titles are translated in the view's script, so the keys are what the
// stubs report back and the assertions stay independent of en.json
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

vi.mock("@/components/artist/artistRows", () => ({
  availableArtistRowIds: mockAvailableArtistRowIds,
  artistRows: {
    resolve: mockResolveArtistRows,
    definition: (id: string) => ({ id, labelKey: id }),
    effectiveSource: () => "all",
    sources: mockArtistRowSources,
  },
}));

// the loaders are mocked, the pure helpers (sorting, single/EP and library
// checks) are the real ones so the rows are derived the way they are in the app
vi.mock("@/components/artist/artistData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/artist/artistData")>()),
  loadArtistReleases: mockLoadArtistReleases,
  loadArtistDiscography: mockLoadArtistDiscography,
  loadArtistTracks: mockLoadArtistTracks,
  loadArtistTopTracks: mockLoadArtistTopTracks,
  loadSimilarArtists: mockLoadSimilarArtists,
  loadArtistAppearsOn: mockLoadArtistAppearsOn,
}));

vi.mock("@/components/artist/ArtistHero.vue", () => ({
  default: {
    name: "ArtistHero",
    props: ["item"],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/details/DetailTextRow.vue", () => ({
  default: { name: "DetailTextRow", template: '<div data-row="bio" />' },
}));
vi.mock("@/components/artist/ArtistTopTracksRow.vue", () => ({
  default: {
    name: "ArtistTopTracksRow",
    template: '<div data-row="top_tracks" />',
  },
}));
// one component backs several rows, so it reports which title it was given
vi.mock("@/components/details/ReleaseShelf.vue", () => ({
  default: {
    name: "ReleaseShelf",
    props: ["title", "items"],
    template: '<div :data-row="title" />',
  },
}));
vi.mock("@/components/artist/ArtistSimilarShelf.vue", () => ({
  default: {
    name: "ArtistSimilarShelf",
    template: '<div data-row="similar_artists" />',
  },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: {
    name: "ProviderDetails",
    template: '<div data-row="provider_mappings" />',
  },
}));
vi.mock("@/components/MediaItemImages.vue", () => ({
  default: { name: "MediaItemImages", template: '<div data-row="artwork" />' },
}));
// the stub renders path/itemtype so tests can read which preference key
// (see userPreferences.ts's getItemsListingPreferences) each row was given
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: [
      "path",
      "itemtype",
      "loadPagedData",
      "sortListing",
      "showFavoritesOnlyFilter",
    ],
    template:
      '<div class="items-listing-stub" :data-path="path" :data-itemtype="itemtype" />',
  },
}));

const MUSIC_ROWS = [
  "bio",
  "top_tracks",
  "albums",
  "singles_eps",
  "appears_on",
  "discography",
  "similar_artists",
];
const AUDIOBOOK_ROWS = ["bio", "audiobooks", "audiobooks_all"];

// one in-library album and one single that is not, so every music row has
// something to render
const RELEASES: Album[] = [
  album({ item_id: "1", provider: "library" }),
  album({
    item_id: "2",
    provider: "spotify--abc",
    album_type: AlbumType.SINGLE,
  }),
];

async function mountDetails(item: Artist) {
  mockGetArtist.mockResolvedValue(item);
  const wrapper = mount(ArtistDetails, {
    props: { itemId: item.item_id, provider: item.provider },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function renderedRows(wrapper: VueWrapper) {
  return wrapper.findAll("[data-row]").map((row) => row.attributes("data-row"));
}

// resolves the persisted-preferences path for the listing row of the given
// itemtype (there is at most one such row per artist in these fixtures)
function pathFor(wrapper: VueWrapper, itemtype: string) {
  return wrapper.find(`[data-itemtype="${itemtype}"]`).attributes("data-path");
}

describe("ArtistDetails", () => {
  beforeEach(() => {
    mockGetArtist.mockReset();
    mockGetArtistAudiobooks.mockReset().mockResolvedValue([]);
    mockSubscribe.mockReset().mockReturnValue(() => {});
    mockAvailableArtistRowIds
      .mockReset()
      .mockImplementation((isAudiobookArtist: boolean) =>
        isAudiobookArtist ? AUDIOBOOK_ROWS : MUSIC_ROWS,
      );
    mockResolveArtistRows
      .mockReset()
      .mockImplementation((availableIds: string[]) => ({
        order: availableIds,
        hidden: new Set<string>(),
      }));
    // a library artist mapped to a provider that can supply the row
    mockArtistRowSources.mockReset().mockReturnValue(["library", "all"]);
    mockLoadArtistReleases.mockReset().mockResolvedValue(RELEASES);
    mockLoadArtistDiscography.mockReset().mockResolvedValue([album()]);
    mockLoadArtistTracks.mockReset().mockResolvedValue([track()]);
    mockLoadArtistTopTracks.mockReset().mockResolvedValue([track()]);
    mockLoadSimilarArtists.mockReset().mockResolvedValue([artist()]);
    mockLoadArtistAppearsOn
      .mockReset()
      .mockResolvedValue([album({ item_id: "3" })]);
  });

  it("renders the rows in the resolved order", async () => {
    const wrapper = await mountDetails(
      artist({ metadata: { description: "A biography" } }),
    );

    expect(renderedRows(wrapper)).toEqual(MUSIC_ROWS);
  });

  it("skips a hidden row", async () => {
    mockResolveArtistRows.mockImplementation((availableIds: string[]) => ({
      order: availableIds,
      hidden: new Set(["albums"]),
    }));

    const wrapper = await mountDetails(
      artist({ metadata: { description: "A biography" } }),
    );

    expect(renderedRows(wrapper)).not.toContain("albums");
    expect(renderedRows(wrapper)).toContain("singles_eps");
  });

  it("keeps an empty release row visible when a provider can still supply it", async () => {
    // no in-library releases, but the artist is mapped to a provider that can
    mockLoadArtistReleases.mockResolvedValue([]);

    const wrapper = await mountDetails(artist());

    // the row stays so its "See all" reaches the provider's catalog
    expect(renderedRows(wrapper)).toContain("albums");
    expect(renderedRows(wrapper)).toContain("singles_eps");
  });

  it("hides an empty release row with no other source to browse", async () => {
    mockLoadArtistReleases.mockResolvedValue([]);
    // only the library feeds the row, so an empty one has nowhere else to go
    mockArtistRowSources.mockReturnValue(["library"]);

    const wrapper = await mountDetails(artist());

    expect(renderedRows(wrapper)).not.toContain("albums");
    expect(renderedRows(wrapper)).not.toContain("singles_eps");
  });

  it("keeps an empty top-tracks or similar row visible while it can switch source", async () => {
    // the picked source and the library fallback both come up empty, so the
    // row's inline picker is the only way back to a source that has content
    mockLoadArtistTopTracks.mockResolvedValue([]);
    mockLoadArtistTracks.mockResolvedValue([]);
    mockLoadSimilarArtists.mockResolvedValue([]);

    const wrapper = await mountDetails(artist());

    expect(renderedRows(wrapper)).toContain("top_tracks");
    expect(renderedRows(wrapper)).toContain("similar_artists");
  });

  it("hides an empty top-tracks or similar row with only one source", async () => {
    mockLoadArtistTopTracks.mockResolvedValue([]);
    mockLoadArtistTracks.mockResolvedValue([]);
    mockLoadSimilarArtists.mockResolvedValue([]);
    // a single source means no picker, so an empty row has nowhere else to go
    mockArtistRowSources.mockReturnValue(["all"]);

    const wrapper = await mountDetails(artist());

    expect(renderedRows(wrapper)).not.toContain("top_tracks");
    expect(renderedRows(wrapper)).not.toContain("similar_artists");
  });

  it("shows the discography of a library artist", async () => {
    const wrapper = await mountDetails(artist());

    expect(renderedRows(wrapper)).toContain("discography");
  });

  it("leaves the discography out for a provider artist", async () => {
    const wrapper = await mountDetails(artist({ provider: "spotify--abc" }));

    expect(renderedRows(wrapper)).not.toContain("discography");
  });

  it("counts a library artist's tracks as in the library in the rows editor", async () => {
    const wrapper = await mountDetails(artist());

    const editor = wrapper.findComponent({ name: "RowsEditor" });
    expect(editor.props("rowMeta").top_tracks).toBe("n_in_library");
  });

  it("counts a provider artist's tracks as plain tracks in the rows editor", async () => {
    const wrapper = await mountDetails(artist({ provider: "spotify--abc" }));

    const editor = wrapper.findComponent({ name: "RowsEditor" });
    expect(editor.props("rowMeta").top_tracks).toBe("n_tracks");
  });

  it("shows the newest releases on the shelf and keeps the rest for the listing", async () => {
    mockLoadArtistDiscography.mockResolvedValue(
      Array.from({ length: 60 }, (_, index) =>
        album({ item_id: String(index) }),
      ),
    );

    const wrapper = await mountDetails(artist());

    const shelf = wrapper
      .findAllComponents({ name: "ReleaseShelf" })
      .find((component) => component.props("title") === "discography");
    expect(shelf?.props("items")).toHaveLength(50);
  });

  // MusicBrainz is not loaded, or does not know the artist
  it("hides the discography once it comes up empty", async () => {
    mockLoadArtistDiscography.mockResolvedValue([]);

    const wrapper = await mountDetails(artist());

    expect(renderedRows(wrapper)).not.toContain("discography");
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

    // the path must not embed the artist id, otherwise each artist gets its
    // own view mode/sort/filter preferences instead of sharing one
    expect(audiobooksPathA).not.toContain("author-a");
    expect(audiobooksPathA).toBe(pathFor(wrapperB, "artistaudiobooks"));
  });

  it("loads library audiobooks with server paging and collapse settings", async () => {
    const item = artist({
      item_id: "author-1",
      provider: "library",
      artist_type: ArtistType.AUTHOR,
    });
    const wrapper = await mountDetails(item);
    const listing = wrapper.findComponent({ name: "ItemsListing" });
    const params: LoadDataParams = {
      offset: 40,
      limit: 20,
      sortBy: "name:asc",
      sortField: SortField.NAME,
      sortDirection: SortDirection.ASC,
      search: "story",
      collapseCollections: true,
    };

    await listing.props("loadPagedData")(params);

    expect(listing.props("sortListing")).toBe(ListingType.ARTIST_AUDIOBOOKS);
    expect(listing.props("showFavoritesOnlyFilter")).toBe(false);
    expect(mockGetArtistAudiobooks).toHaveBeenCalledWith(
      "author-1",
      "library",
      ArtistType.AUTHOR,
      undefined,
      true,
      "story",
      20,
      40,
      SortField.NAME,
      SortDirection.ASC,
      undefined,
    );
  });

  it("forwards the selected audiobook source as a server filter", async () => {
    const item = artist({
      item_id: "author-1",
      provider: "library",
      artist_type: ArtistType.AUTHOR,
      provider_mappings: [
        providerMapping({
          item_id: "provider-author",
          provider_domain: "qobuz",
          provider_instance: "qobuz_1",
        }),
      ],
    });
    const wrapper = await mountDetails(item);
    await wrapper
      .findComponent({ name: "ItemsListing" })
      .props("loadPagedData")({
      offset: 0,
      limit: 20,
      sortBy: "name:asc",
      search: "",
      provider: ["qobuz_1"],
    });

    expect(mockGetArtistAudiobooks).toHaveBeenCalledWith(
      "provider-author",
      "qobuz_1",
      ArtistType.AUTHOR,
      undefined,
      undefined,
      "",
      20,
      0,
      undefined,
      undefined,
      "qobuz_1",
    );
  });
});
