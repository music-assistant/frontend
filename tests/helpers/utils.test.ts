import {
  formatAliasName,
  formatDuration,
  formatRelativeTime,
  getGenreDisplayName,
  hexToRgb,
  kebabize,
  numberRange,
  paletteFromServer,
  parseBool,
  rgbToHex,
  sleep,
  truncateString,
} from "@/helpers/utils";
import type { MediaItemPalette } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  api: {
    serverInfo: { value: null },
    players: {},
  },
}));

vi.mock("@/plugins/store", () => ({
  store: {},
}));

vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: vi.fn(() => false),
}));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/web_player", () => ({
  webPlayer: { player_id: null },
  WebPlayerMode: {},
}));

vi.mock("@/layouts/default/ItemContextMenu.vue", () => ({
  showContextMenuForMediaItem: vi.fn(),
  showPlayMenuForMediaItem: vi.fn(),
}));

vi.mock("@/plugins/api/helpers", () => ({
  itemIsAvailable: vi.fn(),
}));

describe("formatDuration", () => {
  it("formats seconds correctly", () => {
    expect(formatDuration(30)).toBe("00:30");
    expect(formatDuration(90)).toBe("01:30");
    expect(formatDuration(3661)).toBe("01:01:01");
  });

  it("handles zero duration", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  it("handles hours correctly", () => {
    expect(formatDuration(3600)).toBe("01:00:00");
    expect(formatDuration(7200)).toBe("02:00:00");
  });

  it("pads single digits with zeros", () => {
    expect(formatDuration(5)).toBe("00:05");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(3665)).toBe("01:01:05");
  });
});

describe("truncateString", () => {
  it("truncates long strings", () => {
    expect(truncateString("Hello World", 5)).toBe("Hello...");
    expect(truncateString("This is a long string", 10)).toBe("This is a ...");
  });

  it("returns original string if shorter than limit", () => {
    expect(truncateString("Short", 10)).toBe("Short");
    expect(truncateString("Hello", 5)).toBe("Hello");
  });

  it("handles empty strings", () => {
    expect(truncateString("", 5)).toBe("");
  });

  it("handles null/undefined input", () => {
    // @ts-expect-error testing invalid input
    expect(truncateString(null, 5)).toBe("");
    // @ts-expect-error testing invalid input
    expect(truncateString(undefined, 5)).toBe("");
  });
});

describe("parseBool", () => {
  it("parses boolean values correctly", () => {
    expect(parseBool(true)).toBe(true);
    expect(parseBool(false)).toBe(false);
  });

  it("parses string values correctly", () => {
    expect(parseBool("true")).toBe(true);
    expect(parseBool("false")).toBe(false);
    expect(parseBool("TRUE")).toBe(true);
    expect(parseBool("FALSE")).toBe(false);
  });

  it("handles null/undefined", () => {
    expect(parseBool(null)).toBe(false);
    expect(parseBool(undefined)).toBe(false);
  });

  it("handles empty values", () => {
    expect(parseBool("")).toBe(false);
    expect(parseBool("0")).toBe(false);
  });
});

describe("kebabize", () => {
  it("converts camelCase to kebab-case", () => {
    expect(kebabize("camelCase")).toBe("camel-case");
    expect(kebabize("PascalCase")).toBe("pascal-case");
    expect(kebabize("someVeryLongVariableName")).toBe(
      "some-very-long-variable-name",
    );
  });

  it("handles single words", () => {
    expect(kebabize("word")).toBe("word");
    expect(kebabize("Word")).toBe("word");
  });

  it("handles empty strings", () => {
    expect(kebabize("")).toBe("");
  });
});

describe("color utilities", () => {
  describe("hexToRgb", () => {
    it("converts hex to RGB correctly", () => {
      expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
      expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
      expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
      expect(hexToRgb("ff0000")).toEqual([255, 0, 0]);
    });
  });

  describe("rgbToHex", () => {
    it("converts RGB to hex correctly", () => {
      expect(rgbToHex([255, 255, 255])).toBe("#ffffff");
      expect(rgbToHex([0, 0, 0])).toBe("#000000");
      expect(rgbToHex([255, 0, 0])).toBe("#ff0000");
    });
  });

  describe("paletteFromServer", () => {
    it("returns empty palette for null", () => {
      expect(paletteFromServer(null)).toEqual({
        lightColor: "",
        darkColor: "",
      });
    });

    it("returns empty palette for undefined", () => {
      expect(paletteFromServer(undefined)).toEqual({
        lightColor: "",
        darkColor: "",
      });
    });

    it("returns empty strings when on_dark and on_light are missing", () => {
      const palette: MediaItemPalette = {};
      expect(paletteFromServer(palette)).toEqual({
        lightColor: "",
        darkColor: "",
      });
    });

    it("returns empty strings when on_dark and on_light are null", () => {
      const palette: MediaItemPalette = { on_dark: null, on_light: null };
      expect(paletteFromServer(palette)).toEqual({
        lightColor: "",
        darkColor: "",
      });
    });

    it("maps on_dark to lightColor and on_light to darkColor", () => {
      const palette: MediaItemPalette = {
        on_dark: [255, 200, 100],
        on_light: [40, 20, 10],
      };
      expect(paletteFromServer(palette)).toEqual({
        lightColor: "#ffc864",
        darkColor: "#28140a",
      });
    });

    it("handles only one of on_dark/on_light being set", () => {
      expect(paletteFromServer({ on_dark: [255, 255, 255] })).toEqual({
        lightColor: "#ffffff",
        darkColor: "",
      });
      expect(paletteFromServer({ on_light: [0, 0, 0] })).toEqual({
        lightColor: "",
        darkColor: "#000000",
      });
    });
  });
});

describe("formatAliasName", () => {
  it("capitalizes the first letter of each word", () => {
    expect(formatAliasName("hip hop")).toBe("Hip Hop");
    expect(formatAliasName("classic rock")).toBe("Classic Rock");
  });

  it("handles single words", () => {
    expect(formatAliasName("jazz")).toBe("Jazz");
    expect(formatAliasName("rock")).toBe("Rock");
  });

  it("handles already capitalized strings", () => {
    expect(formatAliasName("Jazz")).toBe("Jazz");
    expect(formatAliasName("Hip Hop")).toBe("Hip Hop");
  });

  it("handles empty and falsy values", () => {
    expect(formatAliasName("")).toBe("");
    // @ts-expect-error Testing invalid input: null is not a string
    expect(formatAliasName(null)).toBe("");
    // @ts-expect-error Testing invalid input: undefined is not a string
    expect(formatAliasName(undefined)).toBe("");
  });
});

describe("formatRelativeTime", () => {
  it("formats seconds", () => {
    expect(formatRelativeTime(0)).toBe("0s");
    expect(formatRelativeTime(30)).toBe("30s");
    expect(formatRelativeTime(59)).toBe("59s");
  });

  it("formats minutes", () => {
    expect(formatRelativeTime(60)).toBe("1m");
    expect(formatRelativeTime(90)).toBe("1m");
    expect(formatRelativeTime(3599)).toBe("59m");
  });

  it("formats hours", () => {
    expect(formatRelativeTime(3600)).toBe("1h");
    expect(formatRelativeTime(3660)).toBe("1h 1m");
    expect(formatRelativeTime(7200)).toBe("2h");
    expect(formatRelativeTime(7380)).toBe("2h 3m");
  });
});

describe("getGenreDisplayName", () => {
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      "genre_names.rock": "Rock",
      "genre_names.hip_hop": "Hip Hop",
      full_key: "Full Key Translation",
    };
    return translations[key] || key;
  };

  const mockTe = (key: string) => {
    const known = ["genre_names.rock", "genre_names.hip_hop", "full_key"];
    return known.includes(key);
  };

  it("uses translation_key directly if it resolves", () => {
    expect(getGenreDisplayName("rock", "full_key", mockT, mockTe)).toBe(
      "Full Key Translation",
    );
  });

  it("uses translation_key with genre_names prefix", () => {
    expect(getGenreDisplayName("rock", "rock", mockT, mockTe)).toBe("Rock");
  });

  it("generates key from name as fallback", () => {
    expect(getGenreDisplayName("hip hop", undefined, mockT, mockTe)).toBe(
      "Hip Hop",
    );
  });

  it("applies sentence case when no translation found", () => {
    expect(
      getGenreDisplayName("my custom genre", undefined, mockT, mockTe),
    ).toBe("My custom genre");
  });

  it("handles empty name", () => {
    expect(getGenreDisplayName("", undefined, mockT, mockTe)).toBe("");
  });
});

describe("utility functions", () => {
  describe("sleep", () => {
    it("resolves after specified delay", async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90);
    });
  });

  describe("numberRange", () => {
    it("creates range of numbers", () => {
      expect(numberRange(1, 3)).toEqual([1, 2, 3]);
      expect(numberRange(0, 2)).toEqual([0, 1, 2]);
      expect(numberRange(5, 7)).toEqual([5, 6, 7]);
    });

    it("handles single number range", () => {
      expect(numberRange(5, 5)).toEqual([5]);
    });
  });
});
