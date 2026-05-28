import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSetupDebouncedSearch } = vi.hoisted(() => ({
  mockSetupDebouncedSearch: vi.fn(),
}));

vi.mock("@/composables/useSmartPlaylistSearchHelpers", () => ({
  setupDebouncedSearch: mockSetupDebouncedSearch,
}));

vi.mock("@/helpers/utils", () => ({
  buildItemUri: vi.fn(
    (
      mediaType: string,
      mapping: { provider_domain?: string; item_id?: string } | null,
      fallbackItemId: string,
    ) => {
      const domain = mapping?.provider_domain ?? "library";
      const itemId = mapping?.item_id ?? fallbackItemId;
      return `${domain}://${mediaType}/${itemId}`;
    },
  ),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    providers: {
      spotify_instance: {
        instance_id: "spotify_instance",
        supported_features: ["similar_tracks"],
      },
      tidal_instance: {
        instance_id: "tidal_instance",
        supported_features: ["similar_artists"],
      },
      other_instance: {
        instance_id: "other_instance",
        supported_features: [],
      },
    },
    search: vi.fn(),
  },
}));

import api from "@/plugins/api";
import { useSmartPlaylistSeedItems } from "@/composables/useSmartPlaylistSeedItems";

interface SearchFnArg {
  searchFn: (q: string) => Promise<unknown[]>;
}

describe("useSmartPlaylistSeedItems", () => {
  beforeEach(() => {
    mockSetupDebouncedSearch.mockClear();
  });

  it("collects provider ids for similar tracks and artists", () => {
    const seed = useSmartPlaylistSeedItems();

    expect(seed.similarTrackProviderIds.value).toEqual(["spotify_instance"]);
    expect(seed.similarArtistProviderIds.value).toEqual(["tidal_instance"]);
    expect(mockSetupDebouncedSearch).toHaveBeenCalledTimes(2);
  });

  it("selectSeedTrack stores URI and clears search state", () => {
    const seed = useSmartPlaylistSeedItems();

    seed.seedTrackSearch.value = "query";
    seed.seedTrackResults.value = [{ item_id: "x" } as any];

    seed.selectSeedTrack({
      item_id: "fallback-track-id",
      provider_mappings: [
        {
          item_id: "sp-track-1",
          provider_instance: "spotify_instance",
          provider_domain: "spotify",
        },
      ],
      artists: [{ name: "Artist" }],
      name: "Song",
    } as any);

    expect(seed.seedTrackUri.value).toBe("spotify://track/sp-track-1");
    expect(seed.seedTrackSearch.value).toBe("");
    expect(seed.seedTrackResults.value).toEqual([]);
  });

  it("selectSeedArtist stores URI and clears selected seed track", () => {
    const seed = useSmartPlaylistSeedItems();

    seed.selectedSeedTrack.value = {
      item_id: "old-track",
      provider_mappings: [],
    } as any;
    seed.seedTrackUri.value = "spotify://track/old-track";

    seed.selectSeedArtist({
      item_id: "fallback-artist-id",
      provider_mappings: [
        {
          item_id: "tidal-artist-1",
          provider_instance: "tidal_instance",
          provider_domain: "tidal",
        },
      ],
      name: "Artist",
    } as any);

    expect(seed.seedArtistUri.value).toBe("tidal://artist/tidal-artist-1");
    expect(seed.selectedSeedTrack.value).toBeNull();
    expect(seed.seedTrackUri.value).toBe("");
  });

  describe("seed-track search filter", () => {
    const originalProviders = (api as unknown as { providers: unknown })
      .providers;

    beforeEach(() => {
      vi.mocked(api.search).mockClear();
      (api as unknown as { providers: unknown }).providers = originalProviders;
    });

    it("returns library/streaming results when only a plugin supplies SIMILAR_TRACKS", async () => {
      useSmartPlaylistSeedItems();
      const trackSearchFn = (
        mockSetupDebouncedSearch.mock.calls[0][0] as SearchFnArg
      ).searchFn;

      vi.mocked(api.search).mockResolvedValueOnce({
        tracks: [
          {
            item_id: "lib-1",
            name: "Library Track",
            provider_mappings: [
              { provider_instance: "library", provider_domain: "library" },
              {
                provider_instance: "filesystem_local",
                provider_domain: "filesystem_local",
              },
            ],
          },
        ],
        artists: [],
        albums: [],
        playlists: [],
        radio: [],
        audiobooks: [],
        podcasts: [],
      } as never);

      const results = await trackSearchFn("anything");

      expect(results).toHaveLength(1);
      expect(api.search).toHaveBeenCalledWith("anything", ["track"], 20);
    });

    it("returns [] without searching when no provider supplies SIMILAR_TRACKS", async () => {
      (api as unknown as { providers: Record<string, unknown> }).providers = {
        only_unrelated: {
          instance_id: "only_unrelated",
          supported_features: [],
        },
      };
      useSmartPlaylistSeedItems();
      const trackSearchFn = (
        mockSetupDebouncedSearch.mock.calls.at(-1)?.[0] as SearchFnArg
      ).searchFn;

      const results = await trackSearchFn("anything");

      expect(results).toEqual([]);
      expect(api.search).not.toHaveBeenCalled();
    });
  });
});
