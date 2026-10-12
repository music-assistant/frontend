import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockSetUserPreference } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockSetUserPreference: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
}));

import {
  mergeOrder,
  readRowsConfig,
  resolveRowsConfig,
  withRowHidden,
  withRowsOrder,
  writeRowsConfig,
} from "@/helpers/rowsConfig";

const PREFERENCE_KEY = "page.rows";
const AVAILABLE = ["a", "b", "c"];

describe("rowsConfig", () => {
  beforeEach(() => {
    mockSetUserPreference.mockReset();
    storeMock.currentUser = { preferences: {} };
  });

  describe("readRowsConfig", () => {
    it("returns empty arrays without a stored config", () => {
      expect(readRowsConfig(PREFERENCE_KEY)).toEqual({
        hidden: [],
        shown: [],
        order: [],
      });
    });

    it("normalizes a partial or invalid stored config", () => {
      storeMock.currentUser = {
        preferences: { [PREFERENCE_KEY]: { hidden: ["a"], order: "nonsense" } },
      };
      expect(readRowsConfig(PREFERENCE_KEY)).toEqual({
        hidden: ["a"],
        shown: [],
        order: [],
      });
    });
  });

  describe("writeRowsConfig", () => {
    it("persists all three arrays under the given key", async () => {
      await writeRowsConfig(PREFERENCE_KEY, { hidden: ["a"] });
      expect(mockSetUserPreference).toHaveBeenCalledWith(PREFERENCE_KEY, {
        hidden: ["a"],
        shown: [],
        order: [],
      });
    });
  });

  describe("resolveRowsConfig", () => {
    it("returns the default order with nothing hidden for an empty config", () => {
      const { order, hidden } = resolveRowsConfig({}, AVAILABLE);
      expect(order).toEqual(AVAILABLE);
      expect(hidden.size).toBe(0);
    });

    it("applies the saved order and visibility", () => {
      const { order, hidden } = resolveRowsConfig(
        { hidden: ["b"], order: ["c", "b", "a"] },
        AVAILABLE,
      );
      expect(order).toEqual(["c", "b", "a"]);
      expect(hidden).toEqual(new Set(["b"]));
    });

    it("drops unavailable rows from the resolved order and hidden set", () => {
      const { order, hidden } = resolveRowsConfig(
        { hidden: ["gone"], order: ["gone", "c", "a"] },
        AVAILABLE,
      );
      expect(order).toEqual(["c", "a", "b"]);
      expect(hidden.size).toBe(0);
    });

    it("hides a default-off row until the user opts it in", () => {
      expect(resolveRowsConfig({}, AVAILABLE, ["b"]).hidden).toEqual(
        new Set(["b"]),
      );
      expect(
        resolveRowsConfig({ shown: ["b"] }, AVAILABLE, ["b"]).hidden.size,
      ).toBe(0);
    });

    it("treats hidden as authoritative when a row is in both hidden and shown", () => {
      const { hidden } = resolveRowsConfig(
        { hidden: ["a"], shown: ["a"] },
        AVAILABLE,
      );
      expect(hidden.has("a")).toBe(true);
    });
  });

  describe("withRowHidden", () => {
    it("hiding adds to hidden and clears shown; showing does the reverse", () => {
      expect(withRowHidden({ shown: ["a"] }, "a", true)).toEqual({
        hidden: ["a"],
        shown: [],
      });
      expect(withRowHidden({ hidden: ["a"] }, "a", false)).toEqual({
        hidden: [],
        shown: ["a"],
      });
    });

    it("keeps entries of rows it was not asked about", () => {
      expect(withRowHidden({ hidden: ["gone"] }, "a", true).hidden).toEqual([
        "gone",
        "a",
      ]);
    });
  });

  describe("withRowsOrder", () => {
    it("rearranges the available rows", () => {
      expect(withRowsOrder({}, ["c", "b", "a"], AVAILABLE)?.order).toEqual([
        "c",
        "b",
        "a",
      ]);
    });

    it("keeps unavailable rows in their saved slots", () => {
      const cfg = { order: ["a", "gone", "b"] };
      expect(withRowsOrder(cfg, ["b", "a"], ["a", "b"])?.order).toEqual([
        "b",
        "gone",
        "a",
      ]);
    });

    it("returns undefined for an order containing unknown or duplicate ids", () => {
      expect(withRowsOrder({}, ["bogus", "a"], ["a"])).toBeUndefined();
      expect(withRowsOrder({}, ["a", "a"], ["a", "b"])).toBeUndefined();
    });
  });

  describe("mergeOrder", () => {
    it("slots rows the user never ordered after their preceding default sibling", () => {
      expect(mergeOrder(["c", "a"], AVAILABLE, false)).toEqual(["c", "a", "b"]);
    });

    it("keeps unavailable rows only when asked to", () => {
      expect(mergeOrder(["gone", "a"], ["a"], false)).toEqual(["a"]);
      expect(mergeOrder(["gone", "a"], ["a"], true)).toEqual(["gone", "a"]);
    });
  });
});
