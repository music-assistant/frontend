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

  it("reports SIMILAR_TRACKS provider availability and wires four searches", () => {
    const seed = useSmartPlaylistSeedItems();

    expect(seed.hasSimilarTracksProvider.value).toBe(true);
    expect(mockSetupDebouncedSearch).toHaveBeenCalledTimes(4);
  });

  it("addSeedFromSearch picks a SIMILAR_TRACKS-capable mapping URI and clears search state", () => {
    const seed = useSmartPlaylistSeedItems();

    seed.trackSearch.value = "query";
    seed.trackResults.value = [{ item_id: "x" } as any];

    const added = seed.addSeedFromSearch(
      {
        item_id: "fallback-track-id",
        provider_mappings: [
          {
            item_id: "lib-1",
            provider_instance: "library",
            provider_domain: "library",
          },
          {
            item_id: "sp-track-1",
            provider_instance: "spotify_instance",
            provider_domain: "spotify",
          },
        ],
        artists: [{ name: "Artist" }],
        name: "Song",
      } as any,
      "track",
    );

    expect(added).toBe(true);
    expect(seed.seeds.value).toEqual([
      {
        uri: "spotify://track/sp-track-1",
        kind: "track",
        name: "Song",
        subtitle: "Artist",
      },
    ]);
    expect(seed.trackSearch.value).toBe("");
    expect(seed.trackResults.value).toEqual([]);
  });

  it("addSeedFromSearch falls back to library:// when no SIMILAR_TRACKS mapping exists", () => {
    const seed = useSmartPlaylistSeedItems();

    const added = seed.addSeedFromSearch(
      {
        item_id: "62",
        provider_mappings: [
          {
            item_id: "tidal-album",
            provider_instance: "tidal_instance",
            provider_domain: "tidal",
          },
        ],
        artists: [{ name: "RAM" }],
        name: "One Last Call",
      } as any,
      "album",
    );

    expect(added).toBe(true);
    expect(seed.seeds.value[0]).toMatchObject({
      uri: "library://album/62",
      kind: "album",
      name: "One Last Call",
      subtitle: "RAM",
    });
  });

  it("rejects duplicate seed URIs and enforces the 10-seed cap", () => {
    const seed = useSmartPlaylistSeedItems();

    for (let i = 0; i < 10; i++) {
      expect(
        seed.addSeed({
          uri: `library://track/${i}`,
          kind: "track",
          name: `t${i}`,
        }),
      ).toBe(true);
    }
    expect(seed.isFull.value).toBe(true);
    expect(
      seed.addSeed({ uri: "library://track/extra", kind: "track", name: "x" }),
    ).toBe(false);
    expect(
      seed.addSeed({ uri: "library://track/0", kind: "track", name: "dup" }),
    ).toBe(false);
    expect(seed.seeds.value).toHaveLength(10);
  });

  it("removeSeed removes the matching URI", () => {
    const seed = useSmartPlaylistSeedItems();
    seed.addSeed({ uri: "library://track/1", kind: "track", name: "a" });
    seed.addSeed({ uri: "library://artist/2", kind: "artist", name: "b" });
    seed.removeSeed("library://track/1");
    expect(seed.seeds.value).toEqual([
      { uri: "library://artist/2", kind: "artist", name: "b" },
    ]);
  });

  it("loadSeedsFromUris hydrates seeds with names lookup", () => {
    const seed = useSmartPlaylistSeedItems();
    seed.loadSeedsFromUris(
      [
        { uri: "library://track/1", kind: "track" },
        { uri: "library://artist/2", kind: "artist" },
      ],
      { "library://track/1": "Song" },
    );
    expect(seed.seeds.value).toEqual([
      { uri: "library://track/1", kind: "track", name: "Song" },
      { uri: "library://artist/2", kind: "artist", name: "library://artist/2" },
    ]);
  });

  describe("track search filter", () => {
    const originalProviders = (api as unknown as { providers: unknown })
      .providers;

    beforeEach(() => {
      vi.mocked(api.search).mockClear();
      (api as unknown as { providers: unknown }).providers = originalProviders;
    });

    it("returns library/streaming results when a provider supplies SIMILAR_TRACKS", async () => {
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
        mockSetupDebouncedSearch.mock.calls.at(-1)![0] as SearchFnArg
      ).searchFn;

      const results = await trackSearchFn("anything");

      expect(results).toEqual([]);
      expect(api.search).not.toHaveBeenCalled();
    });
  });
});
