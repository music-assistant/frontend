import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockSetUserPreference, mockGetProvider } = vi.hoisted(
  () => ({
    storeMock: {
      currentUser: null as { preferences?: Record<string, unknown> } | null,
    },
    mockSetUserPreference: vi.fn(),
    mockGetProvider: vi.fn(),
  }),
);

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/api", () => ({
  api: { getProvider: mockGetProvider },
}));

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
}));

import {
  createRowRegistry,
  rowSourceProvider,
  type RowSource,
} from "@/components/details/rowRegistry";

type RowId = "with_picker" | "plain" | "admin";

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
  ],
  preferenceKey: ROWS_KEY,
  sourcesPreferenceKey: SOURCES_KEY,
  sourceCandidates: (_id, item) => item.candidates,
});

const ITEM: Item = { candidates: ["all", "spotify--abc"] };

function setPreferences(preferences: Record<string, unknown>) {
  storeMock.currentUser = { preferences };
}

describe("rowRegistry", () => {
  beforeEach(() => {
    mockSetUserPreference.mockReset();
    mockGetProvider.mockReset();
    setPreferences({});
  });

  it("exposes its rows and preference keys", () => {
    expect(registry.rows.map((row) => row.id)).toEqual([
      "with_picker",
      "plain",
      "admin",
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

  it("resolves the saved order and visibility against the available rows", () => {
    setPreferences({
      [ROWS_KEY]: { hidden: ["plain"], order: ["plain", "with_picker"] },
    });
    const { order, hidden } = registry.resolve(["with_picker", "plain"]);
    expect(order).toEqual(["plain", "with_picker"]);
    expect(hidden).toEqual(new Set(["plain"]));
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

  it("clears both preferences on reset", async () => {
    await registry.reset();
    expect(mockSetUserPreference).toHaveBeenCalledWith(ROWS_KEY, {
      hidden: [],
      shown: [],
      order: [],
    });
    expect(mockSetUserPreference).toHaveBeenLastCalledWith(SOURCES_KEY, {});
  });

  it("keeps only the row preference when no row has a source picker", async () => {
    const plain = createRowRegistry<"plain", Item>({
      rows: [{ id: "plain", labelKey: "plain" }],
      preferenceKey: ROWS_KEY,
    });
    await plain.setSource("plain", "spotify--abc");
    await plain.reset();
    expect(mockSetUserPreference).toHaveBeenCalledTimes(1);
    expect(mockSetUserPreference).toHaveBeenCalledWith(ROWS_KEY, {
      hidden: [],
      shown: [],
      order: [],
    });
  });

  describe("rowSourceProvider", () => {
    it("names the single provider behind a source", () => {
      mockGetProvider.mockReturnValue({ name: "Spotify", domain: "spotify" });
      expect(rowSourceProvider("spotify--abc")).toEqual({
        name: "Spotify",
        domain: "spotify",
      });
      expect(mockGetProvider).toHaveBeenCalledWith("spotify--abc");
    });

    it("has none for the library, every provider, or an unknown one", () => {
      expect(rowSourceProvider("library")).toBeUndefined();
      expect(rowSourceProvider("all")).toBeUndefined();
      expect(rowSourceProvider(undefined)).toBeUndefined();
      expect(rowSourceProvider("spotify--gone")).toBeUndefined();
    });
  });
});
