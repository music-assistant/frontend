import {
  copyToClipboard,
  formatAliasName,
  formatDuration,
  formatRelativeTime,
  getExternalLinkUrl,
  hexToRgb,
  kebabize,
  numberRange,
  openLinkInNewTab,
  paletteFromServer,
  rgbToHex,
  sleep,
  stripBlankLines,
  truncateString,
} from "@/helpers/utils";
import type { MediaItemPalette } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: {
      value: null as { server_version: string } | null,
    },
    players: {},
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
}));

vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: vi.fn(() => false),
}));

beforeEach(() => {
  apiMock.serverInfo.value = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("copyToClipboard", () => {
  const restore: (() => void)[] = [];

  /**
   * Replace a property for the duration of the test.
   */
  const stub = function (target: object, key: string, value: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, value });
    restore.push(() => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    });
  };

  /**
   * Force the legacy path by hiding the Clipboard API, and run the given
   * callback in place of the browser's copy command.
   */
  const stubBrowser = function (onCommand: () => void) {
    stub(navigator, "clipboard", undefined);
    stub(
      document,
      "execCommand",
      vi.fn(() => {
        onCommand();
        // browsers report success even when nothing was written
        return true;
      }),
    );
  };

  /**
   * The node the helper selects from, while it is still mounted.
   */
  const clipboardNode = () =>
    document.querySelector<HTMLElement>("span[aria-hidden='true']");

  afterEach(() => {
    for (const undo of restore.splice(0)) undo();
  });

  it("copies the text when the browser accepts the copy", async () => {
    const setData = vi.fn();
    stubBrowser(() => {
      const event = new Event("copy", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: { setData } });
      clipboardNode()?.dispatchEvent(event);
    });

    await expect(copyToClipboard("provider://artist/id")).resolves.toBe(true);
    expect(setData).toHaveBeenCalledWith("text/plain", "provider://artist/id");
    expect(clipboardNode()).toBeNull();
  });

  it("reports failure when the copy is silently ignored", async () => {
    stubBrowser(() => {});

    await expect(copyToClipboard("provider://artist/id")).resolves.toBe(false);
    expect(clipboardNode()).toBeNull();
  });

  it("reports failure when the copy event carries no clipboard", async () => {
    stubBrowser(() => {
      clipboardNode()?.dispatchEvent(
        new Event("copy", { bubbles: true, cancelable: true }),
      );
    });

    await expect(copyToClipboard("provider://artist/id")).resolves.toBe(false);
  });

  it("keeps the node inside a menu that traps focus", async () => {
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const menuItem = document.createElement("button");
    menu.appendChild(menuItem);
    document.body.appendChild(menu);
    menuItem.focus();

    let host: HTMLElement | null | undefined;
    stubBrowser(() => {
      host = clipboardNode()?.parentElement;
    });

    try {
      await copyToClipboard("provider://artist/id");
      expect(host).toBe(menu);
    } finally {
      document.body.removeChild(menu);
    }
  });
});

describe("getExternalLinkUrl", () => {
  it("returns valid web URLs unchanged", () => {
    expect(getExternalLinkUrl("https://example.com/docs")).toBe(
      "https://example.com/docs",
    );
  });

  it("rejects unsafe URLs", () => {
    expect(getExternalLinkUrl("javascript:alert(1)")).toBeUndefined();
  });

  it.each(["0.0.0", "2.17.0b4"])(
    "uses beta documentation for server version %s",
    (serverVersion) => {
      apiMock.serverInfo.value = { server_version: serverVersion };

      expect(getExternalLinkUrl("https://music-assistant.io/docs")).toBe(
        "https://beta.music-assistant.io/docs",
      );
    },
  );

  it("does not rewrite lookalike hostnames", () => {
    apiMock.serverInfo.value = { server_version: "2.17.0b4" };

    expect(getExternalLinkUrl("https://music-assistant.io.evil.com/docs")).toBe(
      "https://music-assistant.io.evil.com/docs",
    );
  });
});

describe("openLinkInNewTab", () => {
  it("opens normalized links without exposing the opener", () => {
    apiMock.serverInfo.value = { server_version: "2.17.0b4" };
    const anchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      anchors.push(this);
    });

    openLinkInNewTab("https://music-assistant.io/docs");

    expect(anchors[0].getAttribute("href")).toBe(
      "https://beta.music-assistant.io/docs",
    );
    expect(anchors[0].getAttribute("target")).toBe("_blank");
    expect(anchors[0].getAttribute("rel")).toBe("noopener");
  });
});

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

describe("stripBlankLines", () => {
  it("drops blank lines but keeps the line breaks around them", () => {
    expect(stripBlankLines("First.\n\nSecond.\n\n\nThird.")).toBe(
      "First.\nSecond.\nThird.",
    );
  });

  it("turns html paragraphs and breaks into plain lines", () => {
    expect(stripBlankLines("<p>First.</p>\n<p>Second.</p>")).toBe(
      "First.\nSecond.",
    );
    expect(stripBlankLines("Line one<br /><br />Line two")).toBe(
      "Line one\nLine two",
    );
    expect(stripBlankLines("<p>Intro</p><p>&nbsp;</p><p>Outro</p>")).toBe(
      "Intro\nOutro",
    );
  });

  it("drops divider lines, which would otherwise read as a heading", () => {
    expect(stripBlankLines("Show notes\n\n-----\n\nSupport us")).toBe(
      "Show notes\nSupport us",
    );
  });

  it("leaves other markup and list items alone", () => {
    expect(stripBlankLines("Topics:\n\n- watches\n- science")).toBe(
      "Topics:\n- watches\n- science",
    );
    expect(stripBlankLines('<p>See <a href="https://x.test">x</a></p>')).toBe(
      'See <a href="https://x.test">x</a>',
    );
  });

  it("handles escaped newlines from providers that send them literally", () => {
    expect(stripBlankLines("One\\nTwo\\n\\nThree")).toBe("One\nTwo\nThree");
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
    // the server sends every palette key, using null for the colors it could not derive
    const serverPalette = (
      overrides: Partial<MediaItemPalette> = {},
    ): MediaItemPalette => ({
      background_dark: null,
      background_light: null,
      primary: null,
      accent: null,
      on_dark: null,
      on_light: null,
      ...overrides,
    });

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

    it("returns empty strings when on_dark and on_light are null", () => {
      expect(paletteFromServer(serverPalette())).toEqual({
        lightColor: "",
        darkColor: "",
      });
    });

    it("maps on_dark to lightColor and on_light to darkColor", () => {
      const palette = serverPalette({
        on_dark: [255, 200, 100],
        on_light: [40, 20, 10],
      });
      expect(paletteFromServer(palette)).toEqual({
        lightColor: "#ffc864",
        darkColor: "#28140a",
      });
    });

    it("handles only one of on_dark/on_light being set", () => {
      expect(
        paletteFromServer(serverPalette({ on_dark: [255, 255, 255] })),
      ).toEqual({
        lightColor: "#ffffff",
        darkColor: "",
      });
      expect(paletteFromServer(serverPalette({ on_light: [0, 0, 0] }))).toEqual(
        {
          lightColor: "",
          darkColor: "#000000",
        },
      );
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
