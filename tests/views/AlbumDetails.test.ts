import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  ImageType,
  ListingType,
  MediaType,
  SortDirection,
  SortField,
  type Album,
  type EventMessage,
  type Track,
} from "@/plugins/api/interfaces";
import type { LoadDataParams } from "@/composables/useItemsListing";
import AlbumDetails from "@/views/AlbumDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { track } from "../fixtures/track";

const {
  mockGetAlbum,
  mockGetItem,
  mockGetArtist,
  mockBackFromMediaDetails,
  mockSubscribe,
  mockAvailableAlbumRowIds,
  mockResolveAlbumRows,
  mockAlbumRowsSources,
  mockAlbumRowsSetSource,
  mockLoadAlbumTracks,
  mockLoadAlbumVersions,
  mockLoadArtistReleases,
} = vi.hoisted(() => ({
  mockGetAlbum: vi.fn<MusicAssistantApi["getAlbum"]>(),
  mockGetItem: vi.fn<MusicAssistantApi["getItem"]>(),
  mockGetArtist: vi.fn(),
  mockBackFromMediaDetails: vi.fn(),
  mockSubscribe: vi.fn(() => () => {}),
  mockAvailableAlbumRowIds: vi.fn(),
  mockResolveAlbumRows: vi.fn(),
  mockAlbumRowsSources: vi.fn(() => [] as string[]),
  mockAlbumRowsSetSource: vi.fn(),
  mockLoadAlbumTracks: vi.fn(),
  mockLoadAlbumVersions: vi.fn(),
  mockLoadArtistReleases: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getAlbum: mockGetAlbum,
    getItem: mockGetItem,
    getArtist: mockGetArtist,
    subscribe: mockSubscribe,
    subscribe_multi: mockSubscribe,
    providers: {},
    getProvider: () => undefined,
    hasStreamingProviders: { value: false },
    serverInfo: { value: null },
  },
}));

vi.mock("@/helpers/navigation", () => ({
  backFromMediaDetails: mockBackFromMediaDetails,
}));

// row titles are translated in the view's script, so the keys are what the
// stubs report back and the assertions stay independent of en.json
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

vi.mock("@/components/album/albumRows", () => ({
  availableAlbumRowIds: mockAvailableAlbumRowIds,
  albumRows: {
    resolve: mockResolveAlbumRows,
    definition: (id: string) => ({ id, labelKey: id }),
    effectiveSource: () => "library",
    sources: mockAlbumRowsSources,
    setSource: mockAlbumRowsSetSource,
  },
}));

// the loaders are mocked, the pure helpers (the review, the running time) are
// the real ones so the page derives what it shows the way the app does
vi.mock("@/components/album/albumData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/album/albumData")>()),
  loadAlbumTracks: mockLoadAlbumTracks,
  loadAlbumVersions: mockLoadAlbumVersions,
  loadArtistReleases: mockLoadArtistReleases,
}));

vi.mock("@/components/album/AlbumHero.vue", () => ({
  default: {
    name: "AlbumHero",
    props: [
      "item",
      "trackCount",
      "duration",
      "tracksSortField",
      "tracksSortDirection",
    ],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/details/DetailTextRow.vue", () => ({
  default: { name: "DetailTextRow", template: '<div data-row="review" />' },
}));
vi.mock("@/components/details/MediaRowList.vue", () => ({
  default: {
    name: "MediaRowList",
    template: '<div data-row="other_versions" />',
  },
}));
vi.mock("@/components/details/ReleaseShelf.vue", () => ({
  default: {
    name: "ReleaseShelf",
    props: [
      "title",
      "viewAllTo",
      "sourceLabel",
      "sourceDomain",
      "sourceOptions",
      "sourceValue",
    ],
    emits: ["select-source", "edit-rows"],
    template: '<div data-row="more_from_artist" />',
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
vi.mock("@/components/details/RowsEditor.vue", () => ({
  default: {
    name: "RowsEditor",
    props: ["open", "item", "registry", "availableIds", "rowMeta", "subtitle"],
    emits: ["update:open"],
    template: "<div data-rows-editor />",
  },
}));
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: [
      "itemtype",
      "loadPagedData",
      "showFavoritesOnlyFilter",
      "sortListing",
    ],
    // the order the listing shows its tracks in
    data: () => ({ sortField: "duration", sortDirection: "desc" }),
    template: '<div data-row="tracks" :data-itemtype="itemtype" />',
  },
}));

const ALL_ROWS = [
  "tracks",
  "review",
  "other_versions",
  "more_from_artist",
  "provider_mappings",
];

const ALBUM_WITH_REVIEW = album({
  item_id: "1",
  provider: "library",
  metadata: { review: "A review" },
});

async function mountDetails(item: Album = ALBUM_WITH_REVIEW) {
  mockGetAlbum.mockResolvedValue(item);
  return mountRoute(item.item_id, item.provider);
}

/** Mounts the page on the given route, without staging a response for it. */
async function mountRoute(itemId: string, provider: string) {
  const wrapper = mount(AlbumDetails, {
    props: { itemId, provider },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function renderedRows(wrapper: VueWrapper) {
  return wrapper.findAll("[data-row]").map((row) => row.attributes("data-row"));
}

function hero(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "AlbumHero" });
}

/** Catches the page's item updates, to hand it an updated album. */
function captureAlbumUpdates() {
  const onUpdated: Array<(evt: EventMessage) => void> = [];
  mockSubscribe.mockImplementation(((
    type: EventType,
    callback: (evt: EventMessage) => void,
  ) => {
    if (type === EventType.MEDIA_ITEM_UPDATED) onUpdated.push(callback);
    return () => {};
  }) as never);
  return (data: Album) =>
    onUpdated.forEach((callback) => callback({ data } as EventMessage));
}

/** Runs the loader the tracks listing was handed, the way the listing does. */
async function loadTracks(
  wrapper: VueWrapper,
  overrides: Partial<LoadDataParams> = {},
) {
  const listing = wrapper.findComponent({ name: "ItemsListing" });
  const loadPagedData = listing.props("loadPagedData") as (
    params: LoadDataParams,
  ) => Promise<unknown>;
  await loadPagedData({
    offset: 0,
    limit: 50,
    sortBy: "track_number",
    search: "",
    ...overrides,
  });
  await flushPromises();
}

describe("AlbumDetails", () => {
  beforeEach(() => {
    mockGetAlbum.mockReset();
    mockGetItem.mockReset();
    mockBackFromMediaDetails.mockReset();
    mockGetArtist.mockReset().mockResolvedValue(undefined);
    mockSubscribe.mockReset().mockReturnValue(() => {});
    mockAvailableAlbumRowIds.mockReset().mockReturnValue(ALL_ROWS);
    mockAlbumRowsSources.mockReset().mockReturnValue([]);
    mockAlbumRowsSetSource.mockReset();
    mockResolveAlbumRows
      .mockReset()
      .mockImplementation((availableIds: string[]) => ({
        order: availableIds,
        hidden: new Set<string>(),
      }));
    mockLoadAlbumTracks
      .mockReset()
      .mockResolvedValue([
        track({ item_id: "1", duration: 100 }),
        track({ item_id: "2", duration: 42 }),
      ]);
    mockLoadAlbumVersions
      .mockReset()
      .mockResolvedValue([album({ item_id: "2" })]);
    mockLoadArtistReleases
      .mockReset()
      .mockResolvedValue([album({ item_id: "3" })]);
  });

  it("renders the rows in the resolved order", async () => {
    const wrapper = await mountDetails();

    expect(renderedRows(wrapper)).toEqual(ALL_ROWS);
  });

  it("skips a hidden row", async () => {
    mockResolveAlbumRows.mockImplementation((availableIds: string[]) => ({
      order: availableIds,
      hidden: new Set(["other_versions"]),
    }));

    const wrapper = await mountDetails();

    expect(renderedRows(wrapper)).not.toContain("other_versions");
    expect(renderedRows(wrapper)).toContain("tracks");
  });

  it("leaves out the review of an album that has none", async () => {
    const wrapper = await mountDetails(album({ item_id: "1" }));

    expect(renderedRows(wrapper)).not.toContain("review");
  });

  it("counts and times every track of the album for the hero", async () => {
    const wrapper = await mountDetails();

    expect(mockLoadAlbumTracks).toHaveBeenCalledWith(
      ALBUM_WITH_REVIEW,
      false,
      undefined,
      0,
    );
    expect(hero(wrapper).props("trackCount")).toBe(2);
    expect(hero(wrapper).props("duration")).toBe(142);
  });

  // the hero describes the album, not the part of it the listing shows
  it.each<Partial<LoadDataParams>>([
    { libraryOnly: true },
    { favoritesOnly: true },
    { search: "intro" },
    { offset: 50 },
  ])(
    "keeps the whole album in the hero for a listing load with %o",
    async (overrides) => {
      const wrapper = await mountDetails();
      mockLoadAlbumTracks.mockResolvedValue([
        track({ item_id: "1", duration: 5 }),
      ]);

      await loadTracks(wrapper, overrides);

      expect(hero(wrapper).props("trackCount")).toBe(2);
      expect(hero(wrapper).props("duration")).toBe(142);
    },
  );

  it("ignores a late hero reply of the previous album", async () => {
    let resolvePrevious!: (tracks: Track[]) => void;
    mockLoadAlbumTracks.mockReturnValueOnce(
      new Promise<Track[]>((resolve) => (resolvePrevious = resolve)),
    );
    const wrapper = await mountDetails(album({ item_id: "9" }));

    mockGetAlbum.mockResolvedValue(ALBUM_WITH_REVIEW);
    mockLoadAlbumTracks.mockReturnValueOnce(new Promise(() => {}));
    await wrapper.setProps({ itemId: ALBUM_WITH_REVIEW.item_id });
    await flushPromises();
    resolvePrevious([track({ item_id: "1" })]);
    await flushPromises();

    expect(hero(wrapper).props("trackCount")).toBeUndefined();
  });

  it("counts and times the album again when it is updated", async () => {
    const sendUpdate = captureAlbumUpdates();
    const wrapper = await mountDetails();
    expect(hero(wrapper).props("trackCount")).toBe(2);
    mockLoadAlbumTracks.mockResolvedValue([
      track({ item_id: "1", duration: 100 }),
      track({ item_id: "2", duration: 42 }),
      track({ item_id: "3", duration: 58 }),
    ]);

    sendUpdate({ ...ALBUM_WITH_REVIEW, name: "Renamed" });
    await flushPromises();

    expect(mockLoadAlbumTracks).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Renamed" }),
      false,
      undefined,
      0,
    );
    expect(hero(wrapper).props("trackCount")).toBe(3);
    expect(hero(wrapper).props("duration")).toBe(200);
  });

  it("keeps the newest count and time when an older load finishes last", async () => {
    const sendUpdate = captureAlbumUpdates();
    let resolveFirst!: (tracks: Track[]) => void;
    let resolveSecond!: (tracks: Track[]) => void;
    mockLoadAlbumTracks
      .mockReturnValueOnce(
        new Promise<Track[]>((resolve) => (resolveFirst = resolve)),
      )
      .mockReturnValueOnce(
        new Promise<Track[]>((resolve) => (resolveSecond = resolve)),
      );
    const wrapper = await mountDetails();
    sendUpdate({ ...ALBUM_WITH_REVIEW, name: "Renamed" });

    resolveSecond([
      track({ item_id: "1", duration: 100 }),
      track({ item_id: "2", duration: 42 }),
      track({ item_id: "3", duration: 58 }),
    ]);
    await flushPromises();
    resolveFirst([track({ item_id: "1", duration: 100 })]);
    await flushPromises();

    expect(hero(wrapper).props("trackCount")).toBe(3);
    expect(hero(wrapper).props("duration")).toBe(200);
  });

  it("hands the hero's play button the order the track listing shows", async () => {
    const wrapper = await mountDetails();

    expect(hero(wrapper).props("tracksSortField")).toBe(SortField.DURATION);
    expect(hero(wrapper).props("tracksSortDirection")).toBe(SortDirection.DESC);
  });

  it("pages album tracks with the server sort", async () => {
    const wrapper = await mountDetails();
    const listing = wrapper.findComponent({ name: "ItemsListing" });
    const loadPagedData = listing.props("loadPagedData") as (
      params: LoadDataParams,
    ) => Promise<unknown>;

    expect(listing.props("sortListing")).toBe(ListingType.ALBUM_TRACKS);
    await loadPagedData({
      offset: 2,
      limit: 2,
      sortBy: "duration:desc",
      sortField: SortField.DURATION,
      sortDirection: SortDirection.DESC,
      search: "",
    });

    expect(mockLoadAlbumTracks).toHaveBeenLastCalledWith(
      ALBUM_WITH_REVIEW,
      false,
      "",
      2,
      2,
      SortField.DURATION,
      SortDirection.DESC,
      undefined,
    );
  });

  it("shows and passes the server-side favorite filter for album tracks", async () => {
    const wrapper = await mountDetails();
    const listing = wrapper.findComponent({ name: "ItemsListing" });
    expect(listing.props("showFavoritesOnlyFilter")).toBe(true);

    const loadPagedData = listing.props("loadPagedData") as (
      params: LoadDataParams,
    ) => Promise<unknown>;
    await loadPagedData({
      offset: 0,
      limit: 50,
      sortBy: "track_number",
      search: "",
      favoritesOnly: true,
    });

    expect(mockLoadAlbumTracks).toHaveBeenCalledWith(
      ALBUM_WITH_REVIEW,
      false,
      "",
      50,
      0,
      undefined,
      undefined,
      true,
    );
  });

  it("sends the artist shelf to the artist's own albums listing", async () => {
    const wrapper = await mountDetails(
      album({
        item_id: "1",
        artists: [
          {
            item_id: "a1",
            provider: "library",
            name: "Adele",
          } as Album["artists"][number],
        ],
      }),
    );

    const shelf = wrapper.findComponent({ name: "ReleaseShelf" });
    expect(shelf.props("viewAllTo")).toMatchObject({
      name: "artistlisting",
      params: { itemId: "a1", provider: "library", listing: "albums" },
      // the shelf's source rides along so the full listing opens on it
      query: { source: "library" },
    });
  });

  it("labels the artist shelf with the album artist's source", async () => {
    const wrapper = await mountDetails(
      album({
        item_id: "1",
        artists: [
          {
            item_id: "a1",
            provider: "library",
            name: "Adele",
          } as Album["artists"][number],
        ],
      }),
    );

    const shelf = wrapper.findComponent({ name: "ReleaseShelf" });
    expect(shelf.props("sourceLabel")).toBe("in_library");
  });

  it("wires the source picker to the shelf and persists a selection", async () => {
    mockAlbumRowsSources.mockReturnValue(["library", "spotify--x"]);

    const wrapper = await mountDetails(
      album({
        item_id: "1",
        artists: [
          {
            item_id: "a1",
            provider: "library",
            name: "Adele",
          } as Album["artists"][number],
        ],
      }),
    );

    const shelf = wrapper.findComponent({ name: "ReleaseShelf" });
    expect(shelf.props("sourceOptions")).toHaveLength(2);
    expect(shelf.props("sourceValue")).toBe("library");

    shelf.vm.$emit("select-source", "spotify--x");
    expect(mockAlbumRowsSetSource).toHaveBeenCalledWith(
      "more_from_artist",
      "spotify--x",
    );
  });

  // a hidden row on an album with its own wide art needs nothing from the
  // artist, but opening Edit rows must load it so its source picker can appear
  it("loads the full artist when Edit rows opens, even for a hidden wide-art album", async () => {
    mockResolveAlbumRows.mockImplementation((availableIds: string[]) => ({
      order: availableIds,
      hidden: new Set(["more_from_artist"]),
    }));
    const wrapper = await mountDetails(
      album({
        item_id: "1",
        metadata: {
          images: [
            {
              type: ImageType.FANART,
              path: "wide.jpg",
              provider: "builtin",
              remotely_accessible: true,
            },
          ],
        },
        artists: [
          {
            item_id: "a1",
            provider: "library",
            name: "Adele",
          } as Album["artists"][number],
        ],
      }),
    );

    expect(mockGetArtist).not.toHaveBeenCalled();

    wrapper.findComponent({ name: "AlbumHero" }).vm.$emit("edit-rows");
    await flushPromises();

    expect(mockGetArtist).toHaveBeenCalledWith("a1", "library");
  });

  // a discography release the server resolves on demand: get_album does not
  // handle the musicbrainz provider, the generic item lookup does
  it("resolves a MusicBrainz release through the item lookup", async () => {
    const resolved = album({ item_id: "5", name: "Grace" });
    mockGetItem.mockResolvedValue(resolved);

    const wrapper = await mountRoute("rg-1", "musicbrainz");

    expect(mockGetItem).toHaveBeenCalledWith(
      MediaType.ALBUM,
      "rg-1",
      "musicbrainz",
    );
    expect(mockGetAlbum).not.toHaveBeenCalled();
    expect(hero(wrapper).props("item")).toEqual(resolved);
  });

  it("leaves the page when no music service has the release", async () => {
    mockGetItem.mockRejectedValue(new Error("MediaNotFoundError"));

    const wrapper = await mountRoute("rg-1", "musicbrainz");

    expect(mockBackFromMediaDetails).toHaveBeenCalled();
    expect(hero(wrapper).props("item")).toBeUndefined();
  });

  // resolving a release can take a while; the user may have moved on by then
  it("leaves a late failure alone once the page shows another album", async () => {
    let fail: (err: Error) => void = () => {};
    mockGetItem.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const wrapper = await mountRoute("rg-1", "musicbrainz");

    mockGetAlbum.mockResolvedValue(ALBUM_WITH_REVIEW);
    await wrapper.setProps({
      itemId: ALBUM_WITH_REVIEW.item_id,
      provider: ALBUM_WITH_REVIEW.provider,
    });
    await flushPromises();
    fail(new Error("MediaNotFoundError"));
    await flushPromises();

    expect(mockBackFromMediaDetails).not.toHaveBeenCalled();
    expect(hero(wrapper).props("item")).toEqual(ALBUM_WITH_REVIEW);
  });
});
