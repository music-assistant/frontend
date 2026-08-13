import { afterEach, describe, expect, it, vi } from "vitest";

type UserAgentFlags = {
  IS_MOBILE_UA: boolean;
  IS_PHONE_UA: boolean;
  IS_TABLET_UA: boolean;
};

// the width the device keys compare against when the user agent says nothing
const BP3 = 575;

const NO_FLAGS: UserAgentFlags = {
  IS_MOBILE_UA: false,
  IS_PHONE_UA: false,
  IS_TABLET_UA: false,
};

// tall enough that the height never decides anything on its own
const DESKTOP_HEIGHT = 900;

/**
 * Load a fresh breakpoint plugin for the given viewport and user agent flags.
 */
async function loadModule(
  width: number,
  flags: Partial<UserAgentFlags> = {},
  height: number = DESKTOP_HEIGHT,
) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
  vi.resetModules();
  vi.doMock("@/helpers/device", () => ({ ...NO_FLAGS, ...flags }));
  return await import("@/plugins/breakpoint");
}

async function loadBreakpoint(
  width: number,
  flags: Partial<UserAgentFlags> = {},
) {
  return (await loadModule(width, flags)).getBreakpointValue;
}

const originalInnerWidth = Object.getOwnPropertyDescriptor(
  window,
  "innerWidth",
);
const originalInnerHeight = Object.getOwnPropertyDescriptor(
  window,
  "innerHeight",
);

afterEach(() => {
  if (originalInnerWidth) {
    Object.defineProperty(window, "innerWidth", originalInnerWidth);
  }
  if (originalInnerHeight) {
    Object.defineProperty(window, "innerHeight", originalInnerHeight);
  }
  vi.doUnmock("@/helpers/device");
  vi.resetModules();
});

describe("getBreakpointValue", () => {
  describe("numeric breakpoints", () => {
    it("compares the viewport width against the breakpoint", async () => {
      const getBreakpointValue = await loadBreakpoint(900);

      expect(getBreakpointValue("bp5")).toBe(true);
      expect(getBreakpointValue("bp8")).toBe(false);
    });

    it("honours an explicit condition and offset", async () => {
      const getBreakpointValue = await loadBreakpoint(769);

      expect(getBreakpointValue({ breakpoint: "bp5", condition: "lt" })).toBe(
        true,
      );
      expect(
        getBreakpointValue({ breakpoint: "bp5", condition: "lt", offset: -31 }),
      ).toBe(false);
    });
  });

  describe("device keys without a matching user agent", () => {
    it("falls back to the viewport width", async () => {
      const wide = await loadBreakpoint(BP3);
      expect(wide("phone")).toBe(true);

      const narrow = await loadBreakpoint(BP3 - 1);
      expect(narrow("phone")).toBe(false);
    });

    it("defaults an object key to the 'lt' condition", async () => {
      const getBreakpointValue = await loadBreakpoint(BP3 - 1);

      expect(getBreakpointValue({ breakpoint: "phone" })).toBe(true);
      expect(getBreakpointValue("phone")).toBe(false);
    });
  });

  describe("device keys with a matching user agent", () => {
    // each flag must drive only its own key, on a viewport where the width
    // fallback is false, so a mixed-up flag cannot pass unnoticed
    const cases: Array<[keyof UserAgentFlags, "mobile" | "phone" | "tablet"]> =
      [
        ["IS_MOBILE_UA", "mobile"],
        ["IS_PHONE_UA", "phone"],
        ["IS_TABLET_UA", "tablet"],
      ];

    it.each(cases)("%s only matches the %s key", async (flag, key) => {
      const getBreakpointValue = await loadBreakpoint(BP3 - 1, {
        [flag]: true,
      });

      for (const other of ["mobile", "phone", "tablet"] as const) {
        expect(getBreakpointValue(other)).toBe(other === key);
      }
    });

    it("wins over the viewport width", async () => {
      const getBreakpointValue = await loadBreakpoint(1920, {
        IS_TABLET_UA: true,
      });

      expect(getBreakpointValue({ breakpoint: "tablet" })).toBe(true);
    });
  });
});

describe("isPhoneSizedScreen", () => {
  // the two dimensions carry values that are nowhere near each other, so a
  // screen measured on the wrong one reads as the wrong answer
  const DESKTOP = { width: 1280, height: 900 };
  // a phone on its side: wide enough to pass for a desktop, far too short
  const PHONE_LANDSCAPE = { width: 932, height: 430 };
  const PHONE_PORTRAIT = { width: 430, height: 932 };

  async function isPhoneSized(
    { width, height }: { width: number; height: number },
    flags: Partial<UserAgentFlags> = {},
  ) {
    return (await loadModule(width, flags, height)).isPhoneSizedScreen();
  }

  it("leaves a desktop alone", async () => {
    expect(await isPhoneSized(DESKTOP)).toBe(false);
  });

  it("catches a narrow screen", async () => {
    expect(await isPhoneSized(PHONE_PORTRAIT)).toBe(true);
  });

  // the case a width-only rule misses, and the reason the height is read at all
  it("catches a screen too short to lay out for a desktop", async () => {
    expect(await isPhoneSized(PHONE_LANDSCAPE)).toBe(true);
  });

  it("takes the device at its word whatever the screen measures", async () => {
    expect(await isPhoneSized(DESKTOP, { IS_PHONE_UA: true })).toBe(true);
  });

  // a tablet has the room for a desktop layout, so it is decided elsewhere
  it("leaves a tablet to be judged on its screen", async () => {
    expect(await isPhoneSized(DESKTOP, { IS_TABLET_UA: true })).toBe(false);
  });

  it.each([
    ["width", { width: 769, height: 900 }, { width: 768, height: 900 }],
    ["height", { width: 1280, height: 500 }, { width: 1280, height: 499 }],
  ])("takes the %s up to its limit but not past it", async (_, over, under) => {
    expect(await isPhoneSized(over)).toBe(false);
    expect(await isPhoneSized(under)).toBe(true);
  });
});
