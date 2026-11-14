import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  storeMock,
  mockSetUserPreference,
  mockSetUserPreferences,
  mockGetProvider,
  providersMock,
  manifestsMock,
} = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockSetUserPreference: vi.fn(),
  mockSetUserPreferences: vi.fn(),
  mockGetProvider: vi.fn(),
  providersMock: {} as Record<
    string,
    { name: string; domain: string; is_streaming_provider?: boolean }
  >,
  manifestsMock: {} as Record<string, { name: string }>,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/api", () => {
  const api = {
    getProvider: mockGetProvider,
    providers: providersMock,
    providerManifests: manifestsMock,
  };
  return { api, default: api };
});

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
  setUserPreferences: mockSetUserPreferences,
}));

import {
  createRowRegistry,
  rowSourceDisplay,
  rowSourceOptions,
  type RowSource,
} from "@/components/details/rowRegistry";

type RowId = "with_picker" | "plain" | "admin" | "follower";

// the item decides what a row can be fed from
interface Item {
  candidates: RowSource[];
}

const ROWS_KEY = "test.rows";
const SOURCES_KEY = "test.rowSources";

const registry = createRowRegistry<RowId, Item>({
  rows: [
    { id: "with_picker", labelKey: "with_picker", supportsSource: true },
    { id: "plain", labelKey: "plain" },
    { id: "admin", labelKey: "admin", adminOnly: true },
    { id: "follower", labelKey: "follower", hiddenWith: "plain" },
  ],
  preferenceKey: ROWS_KEY,
  sourcesPreferenceKey: SOURCES_KEY,
  sourceCandidates: (_id, item) => item.candidates,
});

const ITEM: Item = { candidates: ["all", "spotify--abc"] };

// one of several accounts of a streaming service, named after the account
const SPOTIFY_ACCOUNT = {
  name: "Spotify [marcelveldt2]",
  domain: "spotify",
  is_streaming_provider: true,
};

function setPreferences(preferences: Record<string, unknown>) {
  storeMock.currentUser = { preferences };
}

describe("rowRegistry", () => {
  beforeEach(() => {
    mockSetUserPreference.mockReset();
    mockSetUserPreferences.mockReset();
    mockGetProvider.mockReset();
    for (const key of Object.keys(providersMock)) delete providersMock[key];
    for (const key of Object.keys(manifestsMock)) delete manifestsMock[key];
    setPreferences({});
  });

  it("exposes its rows and preference keys", () => {
    expect(registry.rows.map((row) => row.id)).toEqual([
      "with_picker",
      "plain",
      "admin",
      "follower",
    ]);
    expect(registry.preferenceKey).toBe(ROWS_KEY);
    expect(registry.sourcesPreferenceKey).toBe(SOURCES_KEY);
    expect(registry.definition("admin")).toEqual({
      id: "admin",
      labelKey: "admin",
      adminOnly: true,
    });
  });

  it("offers the candidates only to a row with a picker", () => {
    expect(registry.sources("with_picker", ITEM)).toEqual(ITEM.candidates);
    expect(registry.sources("plain", ITEM)).toEqual([]);
  });

  it("feeds a row from its first candidate by default", () => {
    expect(registry.effectiveSource("with_picker", ITEM)).toBe("all");
  });

  it("uses the saved source while it is among the candidates", () => {
    setPreferences({ [SOURCES_KEY]: { with_picker: "spotify--abc" } });
    expect(registry.getSource("with_picker")).toBe("spotify--abc");
    expect(registry.effectiveSource("with_picker", ITEM)).toBe("spotify--abc");
  });

  it("ignores a saved source that is no longer among the candidates", () => {
    setPreferences({ [SOURCES_KEY]: { with_picker: "spotify--gone" } });
    expect(registry.effectiveSource("with_picker", ITEM)).toBe("all");
  });

  it("maps a saved account to the offered account of the same service", () => {
    providersMock["spotify--abc"] = SPOTIFY_ACCOUNT;
    providersMock["spotify--xyz"] = {
      ...SPOTIFY_ACCOUNT,
      name: "Spotify [marcelveldt3]",
    };
    setPreferences({ [SOURCES_KEY]: { with_picker: "spotify--xyz" } });
    expect(registry.effectiveSource("with_picker", ITEM)).toBe("spotify--abc");
  });

  it("does not map a saved instance of a non-streaming provider", () => {
    providersMock["spotify--abc"] = {
      ...SPOTIFY_ACCOUNT,
      is_streaming_provider: false,
    };
    providersMock["spotify--xyz"] = {
      ...SPOTIFY_ACCOUNT,
      is_streaming_provider: false,
    };
    setPreferences({ [SOURCES_KEY]: { with_picker: "spotify--xyz" } });
    expect(registry.effectiveSource("with_picker", ITEM)).toBe("all");
  });

  it("falls back to the library when the item offers no candidates", () => {
    const bare = createRowRegistry<RowId, Item>({
      rows: registry.rows,
      preferenceKey: ROWS_KEY,
      sourcesPreferenceKey: SOURCES_KEY,
    });
    expect(bare.sources("with_picker", ITEM)).toEqual([]);
    expect(bare.effectiveSource("with_picker", ITEM)).toBe("library");
  });

  it("lets the page decide the default source", () => {
    const own = createRowRegistry<RowId, Item>({
      rows: registry.rows,
      preferenceKey: ROWS_KEY,
      sourcesPreferenceKey: SOURCES_KEY,
      sourceCandidates: (_id, item) => item.candidates,
      defaultSource: (_id, _item, candidates) => candidates[1],
    });
    expect(own.effectiveSource("with_picker", ITEM)).toBe("spotify--abc");
  });

  describe("resolveSource", () => {
    const AUTO_ITEM: Item = {
      candidates: ["auto", "library", "spotify--abc", "tidal--def"],
    };

    it("passes a source other than auto through as it is", () => {
      expect(registry.resolveSource("with_picker", ITEM)).toBe("all");
      expect(registry.resolveSource("with_picker", ITEM, false)).toBe("all");
    });

    it("works auto out from whether the library holds items for the row", () => {
      expect(
        registry.resolveSource("with_picker", AUTO_ITEM, undefined),
      ).toBeUndefined();
      expect(registry.resolveSource("with_picker", AUTO_ITEM, true)).toBe(
        "library",
      );
      expect(registry.resolveSource("with_picker", AUTO_ITEM, false)).toBe(
        "spotify--abc",
      );
    });

    it("stays on the library when auto has no provider to turn to", () => {
      expect(
        registry.resolveSource(
          "with_picker",
          { candidates: ["auto", "library", "all"] },
          false,
        ),
      ).toBe("library");
    });

    it("keeps a saved source over auto", () => {
      setPreferences({ [SOURCES_KEY]: { with_picker: "tidal--def" } });
      expect(registry.resolveSource("with_picker", AUTO_ITEM, true)).toBe(
        "tidal--def",
      );
      setPreferences({ [SOURCES_KEY]: { with_picker: "library" } });
      expect(registry.resolveSource("with_picker", AUTO_ITEM, false)).toBe(
        "library",
      );
    });
  });

  it("resolves the saved order and visibility against the available rows", () => {
    setPreferences({
      [ROWS_KEY]: { hidden: ["plain"], order: ["plain", "with_picker"] },
    });
    const { order, hidden } = registry.resolve(["with_picker", "plain"]);
    expect(order).toEqual(["plain", "with_picker"]);
    expect(hidden).toEqual(new Set(["plain"]));
  });

  it("hides a row along with the row it follows until it is set itself", () => {
    const available: RowId[] = ["plain", "follower"];

    setPreferences({ [ROWS_KEY]: { hidden: ["plain"] } });
    expect(registry.resolve(available).hidden).toEqual(
      new Set(["plain", "follower"]),
    );

    setPreferences({ [ROWS_KEY]: { hidden: ["plain"], shown: ["follower"] } });
    expect(registry.resolve(available).hidden).toEqual(new Set(["plain"]));

    setPreferences({ [ROWS_KEY]: { hidden: ["follower"] } });
    expect(registry.resolve(available).hidden).toEqual(new Set(["follower"]));
  });

  it("writes a row's visibility, order and source", async () => {
    await registry.setHidden("plain", true);
    expect(mockSetUserPreference).toHaveBeenLastCalledWith(
      ROWS_KEY,
      expect.objectContaining({ hidden: ["plain"] }),
    );

    await registry.setOrder(["plain", "with_picker"], ["with_picker", "plain"]);
    expect(mockSetUserPreference).toHaveBeenLastCalledWith(
      ROWS_KEY,
      expect.objectContaining({ order: ["plain", "with_picker"] }),
    );

    await registry.setSource("with_picker", "spotify--abc");
    expect(mockSetUserPreference).toHaveBeenLastCalledWith(SOURCES_KEY, {
      with_picker: "spotify--abc",
    });
  });

  it("saves auto as no source, so the row follows its default again", async () => {
    setPreferences({
      [SOURCES_KEY]: { with_picker: "spotify--abc", plain: "library" },
    });
    await registry.setSource("with_picker", "auto");
    expect(mockSetUserPreference).toHaveBeenLastCalledWith(SOURCES_KEY, {
      plain: "library",
    });
  });

  it("clears both preferences on reset, in one write", async () => {
    await registry.reset();
    expect(mockSetUserPreferences).toHaveBeenCalledOnce();
    expect(mockSetUserPreferences).toHaveBeenCalledWith({
      [ROWS_KEY]: { hidden: [], shown: [], order: [] },
      [SOURCES_KEY]: {},
    });
  });

  it("clears the extra preferences on reset too", async () => {
    const withExtras = createRowRegistry<"plain", Item>({
      rows: [{ id: "plain", labelKey: "plain" }],
      preferenceKey: ROWS_KEY,
      extraPreferenceKeys: ["test.rowTypes"],
    });
    await withExtras.reset();
    expect(mockSetUserPreferences).toHaveBeenCalledOnce();
    expect(mockSetUserPreferences).toHaveBeenCalledWith({
      [ROWS_KEY]: { hidden: [], shown: [], order: [] },
      "test.rowTypes": null,
    });
  });

  it("keeps only the row preference when no row has a source picker", async () => {
    const plain = createRowRegistry<"plain", Item>({
      rows: [{ id: "plain", labelKey: "plain" }],
      preferenceKey: ROWS_KEY,
    });
    await plain.setSource("plain", "spotify--abc");
    await plain.reset();
    expect(mockSetUserPreference).not.toHaveBeenCalled();
    expect(mockSetUserPreferences).toHaveBeenCalledOnce();
    expect(mockSetUserPreferences).toHaveBeenCalledWith({
      [ROWS_KEY]: { hidden: [], shown: [], order: [] },
    });
  });

  describe("rowSourceOptions", () => {
    it("maps a row's sources to picker options with labels and provider domains", () => {
      providersMock["spotify--abc"] = { name: "Spotify", domain: "spotify" };
      expect(rowSourceOptions(registry, "with_picker", ITEM)).toEqual([
        { value: "all", label: "All sources", domain: undefined },
        { value: "spotify--abc", label: "Spotify", domain: "spotify" },
      ]);
    });

    it("names a streaming provider after the service rather than the account", () => {
      manifestsMock["spotify"] = { name: "Spotify" };
      providersMock["spotify--abc"] = SPOTIFY_ACCOUNT;
      expect(rowSourceOptions(registry, "with_picker", ITEM)).toEqual([
        { value: "all", label: "All sources", domain: undefined },
        { value: "spotify--abc", label: "Spotify", domain: "spotify" },
      ]);
    });

    it("labels the automatic source", () => {
      expect(
        rowSourceOptions(registry, "with_picker", {
          candidates: ["auto", "library"],
        }),
      ).toEqual([
        { value: "auto", label: "Automatic", domain: undefined },
        { value: "library", label: "Your library", domain: undefined },
      ]);
    });

    it("is empty for a row without a source picker", () => {
      expect(rowSourceOptions(registry, "plain", ITEM)).toEqual([]);
    });
  });

  describe("rowSourceDisplay", () => {
    it("reads the library, every-provider and automatic sources", () => {
      expect(rowSourceDisplay("library")).toEqual({ label: "In your library" });
      expect(rowSourceDisplay("all")).toEqual({ label: "All sources" });
      expect(rowSourceDisplay("auto")).toEqual({ label: "Automatic" });
    });

    it("names a provider and carries its domain for the icon", () => {
      mockGetProvider.mockReturnValue({ name: "Spotify", domain: "spotify" });
      expect(rowSourceDisplay("spotify--abc")).toEqual({
        label: "On Spotify",
        domain: "spotify",
      });
    });

    it("names a streaming provider after the service", () => {
      manifestsMock["spotify"] = { name: "Spotify" };
      mockGetProvider.mockReturnValue(SPOTIFY_ACCOUNT);
      expect(rowSourceDisplay("spotify--abc")).toEqual({
        label: "On Spotify",
        domain: "spotify",
      });
    });

    it("falls back to the raw id when the provider is unknown", () => {
      mockGetProvider.mockReturnValue(undefined);
      expect(rowSourceDisplay("spotify--gone")).toEqual({
        label: "On spotify--gone",
        domain: undefined,
      });
    });

    it("has nothing without a source", () => {
      expect(rowSourceDisplay(undefined)).toBeUndefined();
    });
  });
});
