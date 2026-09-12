import type { MusicAssistantApi } from "@/plugins/api";
import {
  ImageType,
  type Artist,
  type MediaItemImage,
  type Track,
} from "@/plugins/api/interfaces";
import TrackDetails from "@/views/TrackDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { track } from "../fixtures/track";

const {
  mockGetTrack,
  mockGetArtist,
  mockSubscribe,
  mockAvailableTrackRowIds,
  mockResolveTrackRows,
  mockTrackRows,
  mockLoadTrackLyrics,
  mockLoadTrackAlbums,
  mockLoadTrackVersions,
  mockLoadSimilarTracks,
} = vi.hoisted(() => {
  const mockResolveTrackRows = vi.fn();
  return {
    mockGetTrack: vi.fn<MusicAssistantApi["getTrack"]>(),
    mockGetArtist: vi.fn<MusicAssistantApi["getArtist"]>(),
    mockSubscribe: vi.fn(() => () => {}),
    mockAvailableTrackRowIds: vi.fn(),
    mockResolveTrackRows,
    mockTrackRows: {
      resolve: mockResolveTrackRows,
      definition: (id: string) => ({ id, labelKey: id }),
      sources: () => [],
    },
    mockLoadTrackLyrics: vi.fn(),
    mockLoadTrackAlbums: vi.fn(),
    mockLoadTrackVersions: vi.fn(),
    mockLoadSimilarTracks: vi.fn(),
  };
});

vi.mock("@/plugins/api", () => ({
  api: {
    getTrack: mockGetTrack,
    getArtist: mockGetArtist,
    subscribe: mockSubscribe,
    providers: {},
    getProvider: () => undefined,
    getProviderManifest: () => undefined,
  },
}));

// row titles are translated in the view's script, so the keys are what the
// stubs report back and the assertions stay independent of en.json
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

// the desktop row shows 8 similar tracks before "View all"
vi.mock("@/plugins/breakpoint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/breakpoint")>()),
  isPhoneSizedScreen: () => false,
}));

vi.mock("@/components/track/trackRows", () => ({
  availableTrackRowIds: mockAvailableTrackRowIds,
  trackRows: mockTrackRows,
}));

// the loaders are mocked, the pure helpers (subtitles, backdrop choice) are
// the real ones so the rows are derived the way they are in the app
vi.mock("@/components/track/trackData", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/track/trackData")>()),
  loadTrackLyrics: mockLoadTrackLyrics,
  loadTrackAlbums: mockLoadTrackAlbums,
  loadTrackVersions: mockLoadTrackVersions,
  loadSimilarTracks: mockLoadSimilarTracks,
}));

vi.mock("@/components/track/TrackHero.vue", () => ({
  default: {
    name: "TrackHero",
    props: ["item", "backdrop"],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/track/TrackLyricsRow.vue", () => ({
  default: {
    name: "TrackLyricsRow",
    props: ["lyrics"],
    template: '<div data-row="lyrics" />',
  },
}));
// one component backs three rows, so it reports which title it was given
vi.mock("@/components/details/MediaRowList.vue", () => ({
  default: {
    name: "MediaRowList",
    props: ["title", "viewAllTo"],
    template: '<div :data-row="title" />',
  },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: {
    name: "ProviderDetails",
    template: '<div data-row="provider_mappings" />',
  },
}));
vi.mock("@/components/details/RowsEditor.vue", () => ({
  default: {
    name: "RowsEditor",
    props: ["registry", "availableIds", "subtitle"],
    template: "<div data-editor />",
  },
}));

const ALL_ROWS = [
  "lyrics",
  "appears_on",
  "other_versions",
  "similar_tracks",
  "provider_mappings",
];

function image(type: ImageType, name: string): MediaItemImage {
  return {
    type,
    path: `data:image/png;base64,${name}`,
    provider: "library",
    remotely_accessible: true,
  };
}

async function mountDetails(item: Track, albumUri?: string) {
  mockGetTrack.mockResolvedValue(item);
  const wrapper = mount(TrackDetails, {
    props: { itemId: item.item_id, provider: item.provider, album: albumUri },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function renderedRows(wrapper: VueWrapper) {
  return wrapper.findAll("[data-row]").map((row) => row.attributes("data-row"));
}

function hero(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "TrackHero" });
}

function similarRow(wrapper: VueWrapper) {
  return wrapper
    .findAllComponents({ name: "MediaRowList" })
    .find((row) => row.props("title") === "similar_tracks")!;
}

function similarTracks(count: number): Track[] {
  return Array.from({ length: count }, (_, index) =>
    track({ item_id: `similar-${index}` }),
  );
}

describe("TrackDetails", () => {
  beforeEach(() => {
    mockGetTrack.mockReset();
    mockGetArtist.mockReset().mockResolvedValue(artist());
    mockSubscribe.mockReset().mockReturnValue(() => {});
    mockAvailableTrackRowIds.mockReset().mockReturnValue(ALL_ROWS);
    mockResolveTrackRows
      .mockReset()
      .mockImplementation((availableIds: string[]) => ({
        order: availableIds,
        hidden: new Set<string>(),
      }));
    mockLoadTrackLyrics.mockReset().mockResolvedValue("La la");
    mockLoadTrackAlbums.mockReset().mockResolvedValue([album()]);
    mockLoadTrackVersions.mockReset().mockResolvedValue([track()]);
    mockLoadSimilarTracks.mockReset().mockResolvedValue([track()]);
  });

  it("renders the rows in the resolved order", async () => {
    const wrapper = await mountDetails(track());

    expect(renderedRows(wrapper)).toEqual(ALL_ROWS);
  });

  it("skips a hidden row", async () => {
    mockResolveTrackRows.mockImplementation((availableIds: string[]) => ({
      order: availableIds,
      hidden: new Set(["appears_on"]),
    }));

    const wrapper = await mountDetails(track());

    expect(renderedRows(wrapper)).not.toContain("appears_on");
    expect(renderedRows(wrapper)).toContain("other_versions");
  });

  it("drops a row that turned out empty and keeps one that is still loading", async () => {
    mockLoadTrackLyrics.mockResolvedValue(undefined);
    mockLoadTrackAlbums.mockResolvedValue([]);
    mockLoadTrackVersions.mockReturnValue(new Promise(() => {}));

    const wrapper = await mountDetails(track());

    expect(renderedRows(wrapper)).toEqual([
      "other_versions",
      "similar_tracks",
      "provider_mappings",
    ]);
  });

  it("hands the lyrics row the text once it is loaded", async () => {
    const wrapper = await mountDetails(track());

    const lyricsRow = wrapper.findComponent({ name: "TrackLyricsRow" });
    expect(lyricsRow.props("lyrics")).toBe("La la");
  });

  it('offers "View all" once the similar tracks outgrow the row', async () => {
    mockLoadSimilarTracks.mockResolvedValue(similarTracks(9));
    const nine = await mountDetails(
      track({ item_id: "7", provider: "spotify--abc" }),
      "library://album/3",
    );
    expect(similarRow(nine).props("viewAllTo")).toEqual({
      name: "tracklisting",
      params: { provider: "spotify--abc", itemId: "7", listing: "similar" },
      query: { album: "library://album/3" },
    });

    mockLoadSimilarTracks.mockResolvedValue(similarTracks(8));
    const eight = await mountDetails(track());
    expect(similarRow(eight).props("viewAllTo")).toBeUndefined();
  });

  it("hands the editor the track page's registry and rows", async () => {
    const wrapper = await mountDetails(track());

    const editor = wrapper.findComponent({ name: "RowsEditor" });
    expect(editor.props("registry")).toBe(mockTrackRows);
    expect(editor.props("availableIds")).toEqual(ALL_ROWS);
    expect(editor.props("subtitle")).toBe("edit_rows_subtitle_track");
  });

  it("asks for the track on the album it was opened from", async () => {
    await mountDetails(
      track({ item_id: "7", provider: "spotify--abc" }),
      "library://album/3",
    );

    expect(mockGetTrack).toHaveBeenCalledWith(
      "7",
      "spotify--abc",
      "library://album/3",
    );
  });

  it("ignores a track response that arrives after the route moved on", async () => {
    let resolveFirst: (item: Track) => void = () => {};
    mockGetTrack.mockImplementationOnce(
      () =>
        new Promise<Track>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    const wrapper = mount(TrackDetails, {
      props: { itemId: "1", provider: "library" },
      global: { mocks: { $t: (key: string) => key } },
    });
    await flushPromises();

    mockGetTrack.mockResolvedValue(track({ item_id: "2" }));
    await wrapper.setProps({ itemId: "2" });
    await flushPromises();
    resolveFirst(track({ item_id: "1" }));
    await flushPromises();

    expect(hero(wrapper).props("item")).toMatchObject({ item_id: "2" });
  });

  it("paints the album's wide art behind the hero straight away", async () => {
    const wrapper = await mountDetails(
      track({
        artists: [artist({ item_id: "a1" })],
        album: album({
          metadata: { images: [image(ImageType.LANDSCAPE, "album-wide")] },
        }),
      }),
    );

    expect(hero(wrapper).props("backdrop")).toBe(
      "data:image/png;base64,album-wide",
    );
    expect(mockGetArtist).not.toHaveBeenCalled();
  });

  it("borrows the first artist's fanart when the track has no wide art", async () => {
    let resolveArtist: (item: Artist) => void = () => {};
    mockGetArtist.mockImplementation(
      () =>
        new Promise<Artist>((resolve) => {
          resolveArtist = resolve;
        }),
    );
    const wrapper = await mountDetails(
      track({
        artists: [artist({ item_id: "a1", provider: "spotify--abc" })],
        metadata: { images: [image(ImageType.THUMB, "cover")] },
      }),
    );

    // the cover is painted while the lookup runs
    expect(mockGetArtist).toHaveBeenCalledWith("a1", "spotify--abc");
    expect(hero(wrapper).props("backdrop")).toBe("data:image/png;base64,cover");

    resolveArtist(
      artist({
        metadata: { images: [image(ImageType.FANART, "artist-fanart")] },
      }),
    );
    await flushPromises();

    expect(hero(wrapper).props("backdrop")).toBe(
      "data:image/png;base64,artist-fanart",
    );
  });

  it("ignores an artist response that arrives after the track changed", async () => {
    let resolveArtist: (item: Artist) => void = () => {};
    mockGetArtist.mockImplementation(
      () =>
        new Promise<Artist>((resolve) => {
          resolveArtist = resolve;
        }),
    );
    const wrapper = await mountDetails(
      track({
        item_id: "1",
        artists: [artist({ item_id: "a1" })],
        metadata: { images: [image(ImageType.THUMB, "cover")] },
      }),
    );

    mockGetTrack.mockResolvedValue(
      track({
        item_id: "2",
        metadata: { images: [image(ImageType.THUMB, "cover-2")] },
      }),
    );
    await wrapper.setProps({ itemId: "2" });
    await flushPromises();
    resolveArtist(
      artist({
        metadata: { images: [image(ImageType.FANART, "artist-fanart")] },
      }),
    );
    await flushPromises();

    expect(hero(wrapper).props("backdrop")).toBe(
      "data:image/png;base64,cover-2",
    );
  });
});
