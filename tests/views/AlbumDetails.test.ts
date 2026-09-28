import type { MusicAssistantApi } from "@/plugins/api";
import { ImageType, type Album } from "@/plugins/api/interfaces";
import AlbumDetails from "@/views/AlbumDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { track } from "../fixtures/track";

const {
  mockGetAlbum,
  mockGetArtist,
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
  mockGetArtist: vi.fn(),
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
    getArtist: mockGetArtist,
    subscribe: mockSubscribe,
    providers: {},
    getProvider: () => undefined,
    hasStreamingProviders: { value: false },
    serverInfo: { value: null },
  },
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
    props: ["item", "trackCount", "duration"],
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
    props: ["itemtype", "loadItems"],
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
  const wrapper = mount(AlbumDetails, {
    props: { itemId: item.item_id, provider: item.provider },
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

/** Runs the loader the tracks listing was handed, the way the listing does. */
async function loadTracks(wrapper: VueWrapper, libraryOnly = false) {
  const listing = wrapper.findComponent({ name: "ItemsListing" });
  await (
    listing.props("loadItems") as (
      params: Record<string, unknown>,
    ) => Promise<unknown>
  )({ libraryOnly });
  await flushPromises();
}

describe("AlbumDetails", () => {
  beforeEach(() => {
    mockGetAlbum.mockReset();
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

  it("counts and times the album from the tracks the listing loaded", async () => {
    const wrapper = await mountDetails();
    expect(hero(wrapper).props("trackCount")).toBeUndefined();

    await loadTracks(wrapper);

    expect(hero(wrapper).props("trackCount")).toBe(2);
    expect(hero(wrapper).props("duration")).toBe(142);
  });

  // the hero describes the album, not the part of it that happens to be in
  // the library
  it("ignores a library-only load for those", async () => {
    const wrapper = await mountDetails();
    await loadTracks(wrapper);

    mockLoadAlbumTracks.mockResolvedValue([
      track({ item_id: "1", duration: 5 }),
    ]);
    await loadTracks(wrapper, true);

    expect(hero(wrapper).props("trackCount")).toBe(2);
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
});
