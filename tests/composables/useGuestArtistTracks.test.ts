import type { Track } from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { artist } from "../fixtures/artist";
import { track } from "../fixtures/track";
import { $t } from "@/plugins/i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetArtistTracks, mockToast } = vi.hoisted(() => {
  return {
    mockGetArtistTracks: vi.fn<MusicAssistantApi["getArtistTracks"]>(),
    mockToast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
});

vi.mock("@/plugins/api", () => ({
  default: {
    getArtistTracks: mockGetArtistTracks,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: mockToast,
}));

import { useGuestArtistTracks } from "@/composables/guest/useGuestArtistTracks";

describe("useGuestArtistTracks", () => {
  beforeEach(() => {
    mockGetArtistTracks.mockReset();
    mockToast.error.mockReset();
  });

  it("selects artist and loads tracks", async () => {
    const tracks = [trackFixture("track1"), trackFixture("track2")];
    mockGetArtistTracks.mockResolvedValueOnce(tracks);

    const { selectedArtist, artistTracks, loadingArtistTracks, selectArtist } =
      useGuestArtistTracks();

    const libraryArtist = artist({ item_id: "artist-id" });

    await selectArtist(libraryArtist);

    expect(loadingArtistTracks.value).toBe(false);
    expect(selectedArtist.value).toStrictEqual(libraryArtist);
    expect(mockGetArtistTracks).toHaveBeenCalledWith("artist-id", "library");
    expect(artistTracks.value).toEqual(tracks);
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

    const first = selectArtist(artist({ item_id: "a1", name: "First" }));
    const second = selectArtist(artist({ item_id: "a2", name: "Second" }));
    await second;
    resolveFirst([trackFixture("first-track")]);
    await first;

    expect(selectedArtist.value?.name).toBe("Second");
    expect(artistTracks.value).toEqual(secondTracks);
  });
});

function trackFixture(itemId: string): Track {
  return track({
    item_id: itemId,
    name: itemId,
    uri: `library://track/${itemId}`,
  });
}
