import type { Artist, Track } from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { artist } from "../fixtures/artist";
import { track } from "../fixtures/track";
import { $t } from "@/plugins/i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetArtistTracks, mockGetArtistTopTracks, mockToast } = vi.hoisted(
  () => {
    return {
      mockGetArtistTracks: vi.fn<MusicAssistantApi["getArtistTracks"]>(),
      mockGetArtistTopTracks: vi.fn<MusicAssistantApi["getArtistTopTracks"]>(),
      mockToast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
      },
    };
  },
);

vi.mock("@/plugins/api", () => ({
  default: {
    getArtistTracks: mockGetArtistTracks,
    getArtistTopTracks: mockGetArtistTopTracks,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: mockToast,
}));

import { useGuestArtistTracks } from "@/composables/guest/useGuestArtistTracks";

describe("useGuestArtistTracks", () => {
  beforeEach(() => {
    mockGetArtistTracks.mockReset();
    mockGetArtistTopTracks.mockReset();
    mockToast.error.mockReset();
  });

  it("selects artist and loads tracks", async () => {
    const tracks = [trackFixture("track1"), trackFixture("track2")];
    mockGetArtistTracks.mockResolvedValueOnce(tracks);

    const { selectedArtist, artistTracks, loadingArtistTracks, selectArtist } =
      useGuestArtistTracks();

    const libraryArtist = artistFixture("artist-id");

    await selectArtist(libraryArtist);

    expect(loadingArtistTracks.value).toBe(false);
    expect(selectedArtist.value).toStrictEqual(libraryArtist);
    expect(mockGetArtistTracks).toHaveBeenCalledWith(
      "artist-id",
      "library",
      undefined,
      undefined,
      0,
    );
    expect(artistTracks.value).toEqual(tracks);
    expect(mockGetArtistTopTracks).not.toHaveBeenCalled();
  });

  it("falls back to the top tracks when the artist lists no tracks", async () => {
    const topTracks = [trackFixture("top1")];
    mockGetArtistTracks.mockResolvedValueOnce([]);
    mockGetArtistTopTracks.mockResolvedValueOnce(topTracks);

    const { artistTracks, loadingArtistTracks, selectArtist } =
      useGuestArtistTracks();

    await selectArtist(artistFixture("artist-id"));

    expect(mockGetArtistTopTracks).toHaveBeenCalledWith("artist-id", "library");
    expect(artistTracks.value).toEqual(topTracks);
    expect(loadingArtistTracks.value).toBe(false);
  });

  it("ignores the top tracks of a selection that was cleared meanwhile", async () => {
    let resolveTopTracks!: (tracks: Track[]) => void;
    mockGetArtistTracks.mockResolvedValueOnce([]);
    mockGetArtistTopTracks.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTopTracks = resolve;
      }),
    );

    const { selectedArtist, artistTracks, selectArtist, clearArtistSelection } =
      useGuestArtistTracks();

    const pending = selectArtist(artist());
    await vi.waitFor(() => expect(mockGetArtistTopTracks).toHaveBeenCalled());
    clearArtistSelection();
    resolveTopTracks([trackFixture("top1")]);
    await pending;

    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
  });

  it("handles artist selection errors and shows snackbar", async () => {
    mockGetArtistTracks.mockRejectedValueOnce(
      new Error("Failed to load tracks"),
    );

    const { selectedArtist, artistTracks, loadingArtistTracks, selectArtist } =
      useGuestArtistTracks();

    await selectArtist(artist());

    expect(loadingArtistTracks.value).toBe(false);
    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
    expect(mockToast.error).toHaveBeenCalledWith(
      $t("providers.party.guest_page.load_artist_tracks_failed"),
    );
  });

  it("clears the artist selection", async () => {
    mockGetArtistTracks.mockResolvedValueOnce([trackFixture("track1")]);

    const { selectedArtist, artistTracks, selectArtist, clearArtistSelection } =
      useGuestArtistTracks();

    await selectArtist(artist());
    clearArtistSelection();

    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
  });

  it("ignores the response of a selection that was cleared meanwhile", async () => {
    let resolveTracks!: (tracks: Track[]) => void;
    mockGetArtistTracks.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTracks = resolve;
      }),
    );

    const {
      selectedArtist,
      artistTracks,
      loadingArtistTracks,
      selectArtist,
      clearArtistSelection,
    } = useGuestArtistTracks();

    const pending = selectArtist(artist());
    clearArtistSelection();
    expect(loadingArtistTracks.value).toBe(false);

    resolveTracks([trackFixture("track1")]);
    await pending;

    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
    expect(loadingArtistTracks.value).toBe(false);
  });

  it("keeps only the latest selection when artists are picked rapidly", async () => {
    let resolveFirst!: (tracks: Track[]) => void;
    const firstTracks = new Promise<Track[]>((resolve) => {
      resolveFirst = resolve;
    });
    const secondTracks = [trackFixture("second-track")];
    mockGetArtistTracks
      .mockReturnValueOnce(firstTracks)
      .mockResolvedValueOnce(secondTracks);

    const { selectedArtist, artistTracks, selectArtist } =
      useGuestArtistTracks();

    const first = selectArtist(artistFixture("a1", "First"));
    const second = selectArtist(artistFixture("a2", "Second"));
    await second;
    resolveFirst([trackFixture("first-track")]);
    await first;

    expect(selectedArtist.value?.name).toBe("Second");
    expect(artistTracks.value).toEqual(secondTracks);
  });
});

function artistFixture(itemId: string, name = itemId): Artist {
  return artist({
    item_id: itemId,
    name,
  });
}

function trackFixture(itemId: string): Track {
  return track({
    item_id: itemId,
    name: itemId,
  });
}
