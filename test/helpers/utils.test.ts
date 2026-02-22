import { describe, expect, it, vi } from "vitest";
import {
  formatAliasName,
  formatDuration,
  formatRelativeTime,
  getContrastingTextColor,
  getGenreDisplayName,
  hexToRgb,
  kebabize,
  numberRange,
  parseBool,
  rgbToHex,
  sleep,
  truncateString,
} from "@/helpers/utils";

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

vi.mock("colorthief", () => ({
  default: class {
    getPalette() {
      return [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 255, 0],
        [255, 0, 255],
      ];
    }
  },
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
    expect(truncateString(null as any, 5)).toBe("");
    expect(truncateString(undefined as any, 5)).toBe("");
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

  describe("getContrastingTextColor", () => {
    it("returns black text for light backgrounds", () => {
      expect(getContrastingTextColor("#ffffff")).toBe("#000000");
      expect(getContrastingTextColor("#f0f0f0")).toBe("#000000");
    });

    it("returns white text for dark backgrounds", () => {
      expect(getContrastingTextColor("#000000")).toBe("#FFFFFF");
      expect(getContrastingTextColor("#333333")).toBe("#FFFFFF");
    });

    it("handles 3-character hex codes", () => {
      expect(getContrastingTextColor("#fff")).toBe("#000000");
      expect(getContrastingTextColor("#000")).toBe("#FFFFFF");
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
    expect(formatAliasName(null as any)).toBe("");
    expect(formatAliasName(undefined as any)).toBe("");
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
