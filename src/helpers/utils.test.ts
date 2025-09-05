import { describe, expect, it, vi } from "vitest";
import {
  formatDuration,
  getContrastingTextColor,
  hexToRgb,
  kebabize,
  numberRange,
  parseBool,
  rgbToHex,
  sleep,
  truncateString,
} from "./utils";

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
