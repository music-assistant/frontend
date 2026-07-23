import type { Artist } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetArtistTracks, mockToast } = vi.hoisted(() => {
  return {
    mockGetArtistTracks: vi.fn(),
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
    const tracks = [{ id: "track1" }, { id: "track2" }];
    mockGetArtistTracks.mockResolvedValueOnce(tracks);

    const { selectedArtist, artistTracks, loadingArtistTracks, selectArtist } =
      useGuestArtistTracks();

    const artist = {
      provider_mappings: [
        { item_id: "artist-id", provider_instance: "provider-1" },
      ],
    } as unknown as Artist;

    await selectArtist(artist);

    expect(loadingArtistTracks.value).toBe(false);
    expect(selectedArtist.value).toStrictEqual(artist);
    expect(mockGetArtistTracks).toHaveBeenCalledWith("artist-id", "provider-1");
    expect(artistTracks.value).toEqual(tracks);
  });

  it("handles artist selection errors and shows snackbar", async () => {
    mockGetArtistTracks.mockRejectedValueOnce(
      new Error("Failed to load tracks"),
    );

    const { selectedArtist, artistTracks, loadingArtistTracks, selectArtist } =
      useGuestArtistTracks();

    const artist = {
      provider_mappings: [
        { item_id: "artist-id", provider_instance: "provider-1" },
      ],
    } as unknown as Artist;

    await selectArtist(artist);

    expect(loadingArtistTracks.value).toBe(false);
    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
    expect(mockToast.error).toHaveBeenCalledWith(
      $t("providers.party.guest_page.load_artist_tracks_failed"),
    );
  });

  it("clears the artist selection", async () => {
    mockGetArtistTracks.mockResolvedValueOnce([{ id: "track1" }]);

    const { selectedArtist, artistTracks, selectArtist, clearArtistSelection } =
      useGuestArtistTracks();

    await selectArtist({
      provider_mappings: [
        { item_id: "artist-id", provider_instance: "provider-1" },
      ],
    } as unknown as Artist);
    clearArtistSelection();

    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
  });

  it("ignores the response of a selection that was cleared meanwhile", async () => {
    let resolveTracks!: (tracks: unknown[]) => void;
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

    const pending = selectArtist({
      provider_mappings: [
        { item_id: "artist-id", provider_instance: "provider-1" },
      ],
    } as unknown as Artist);
    clearArtistSelection();
    expect(loadingArtistTracks.value).toBe(false);

    resolveTracks([{ id: "track1" }]);
    await pending;

    expect(selectedArtist.value).toBeNull();
    expect(artistTracks.value).toEqual([]);
    expect(loadingArtistTracks.value).toBe(false);
  });

  it("keeps only the latest selection when artists are picked rapidly", async () => {
    let resolveFirst!: (tracks: unknown[]) => void;
    const firstTracks = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondTracks = [{ id: "second-track" }];
    mockGetArtistTracks
      .mockReturnValueOnce(firstTracks)
      .mockResolvedValueOnce(secondTracks);

    const { selectedArtist, artistTracks, selectArtist } =
      useGuestArtistTracks();

    const first = selectArtist({
      name: "First",
      provider_mappings: [{ item_id: "a1", provider_instance: "provider-1" }],
    } as unknown as Artist);
    const second = selectArtist({
      name: "Second",
      provider_mappings: [{ item_id: "a2", provider_instance: "provider-1" }],
    } as unknown as Artist);
    await second;
    resolveFirst([{ id: "first-track" }]);
    await first;

    expect((selectedArtist.value as unknown as { name: string }).name).toBe(
      "Second",
    );
    expect(artistTracks.value).toEqual(secondTracks);
  });
});
