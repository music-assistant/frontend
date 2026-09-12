import type { MusicAssistantApi } from "@/plugins/api";
import {
  AlbumType,
  ArtistType,
  type Artist,
  type Album,
} from "@/plugins/api/interfaces";
import ArtistDetails from "@/views/ArtistDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { track } from "../fixtures/track";

const {
  mockGetArtist,
  mockSubscribe,
  mockAvailableArtistRowIds,
  mockResolveArtistRows,
  mockLoadArtistReleases,
  mockLoadArtistLibraryTracks,
  mockLoadArtistTopTracks,
  mockLoadSimilarArtists,
  mockAppearsOnAlbums,
} = vi.hoisted(() => ({
  mockGetArtist: vi.fn<MusicAssistantApi["getArtist"]>(),
  mockSubscribe: vi.fn(() => () => {}),
  mockAvailableArtistRowIds: vi.fn(),
  mockResolveArtistRows: vi.fn(),
  mockLoadArtistReleases: vi.fn(),
  mockLoadArtistLibraryTracks: vi.fn(),
  mockLoadArtistTopTracks: vi.fn(),
  mockLoadSimilarArtists: vi.fn(),
  mockAppearsOnAlbums: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getArtist: mockGetArtist,
    subscribe: mockSubscribe,
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
  resolveArtistRows: mockResolveArtistRows,
  effectiveArtistRowSource: () => "all",
  artistRowSources: () => ["library", "all"],
}));

// the loaders are mocked, the pure helpers (sorting, single/EP and library
// checks) are the real ones so the rows are derived the way they are in the app
vi.mock("@/components/artist/artistData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/artist/artistData")>()),
  loadArtistReleases: mockLoadArtistReleases,
  loadArtistLibraryTracks: mockLoadArtistLibraryTracks,
  loadArtistTopTracks: mockLoadArtistTopTracks,
  loadSimilarArtists: mockLoadSimilarArtists,
  appearsOnAlbums: mockAppearsOnAlbums,
}));

vi.mock("@/components/artist/ArtistHero.vue", () => ({
  default: {
    name: "ArtistHero",
    props: ["item"],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/artist/ArtistBioRow.vue", () => ({
  default: { name: "ArtistBioRow", template: '<div data-row="bio" />' },
}));
vi.mock("@/components/artist/ArtistTopTracksRow.vue", () => ({
  default: {
    name: "ArtistTopTracksRow",
    template: '<div data-row="top_tracks" />',
  },
}));
// one component backs three rows, so it reports which title it was given
vi.mock("@/components/artist/ArtistReleaseShelf.vue", () => ({
  default: {
    name: "ArtistReleaseShelf",
    props: ["title"],
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
    props: ["path", "itemtype"],
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
    mockLoadArtistReleases.mockReset().mockResolvedValue(RELEASES);
    mockLoadArtistLibraryTracks.mockReset().mockResolvedValue([track()]);
    mockLoadArtistTopTracks.mockReset().mockResolvedValue([track()]);
    mockLoadSimilarArtists.mockReset().mockResolvedValue([artist()]);
    mockAppearsOnAlbums.mockReset().mockReturnValue([album({ item_id: "3" })]);
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
});
