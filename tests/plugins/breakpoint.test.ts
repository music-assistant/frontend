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
  vi.doMock("@/helpers/device", () => {
    const ua = { ...NO_FLAGS, ...flags };
    // mirrors how the real module ranks the flags, so a user agent that only
    // says "mobile" still stands for a phone here
    return {
      ...ua,
      DEVICE_TYPE: ua.IS_TABLET_UA
        ? "tablet"
        : ua.IS_PHONE_UA || ua.IS_MOBILE_UA
          ? "phone"
          : "desktop",
    };
  });
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

  // Android reports only "mobile" — no browser there still names the model the
  // phone check wants — so taking the device at its word has to mean that too
  it.each([{ IS_PHONE_UA: true }, { IS_MOBILE_UA: true }])(
    "takes the device at its word whatever the screen measures (%o)",
    async (flags) => {
      expect(await isPhoneSized(DESKTOP, flags)).toBe(true);
    },
  );

  // A tablet is only taken at its word where the layout is decided; here it is
  // measured like anything else, so a narrow one in portrait reads as
  // phone-sized and folds its sidebar away, as it did before this predicate.
  it.each([
    ["a screen with the room for a desktop", DESKTOP, false],
    ["a large tablet in portrait", { width: 834, height: 1194 }, false],
    ["a narrow tablet in portrait", { width: 768, height: 1024 }, true],
  ])(
    "measures %s rather than taking the tablet at its word",
    async (_, screen, expected) => {
      expect(
        await isPhoneSized(screen, { IS_TABLET_UA: true, IS_MOBILE_UA: true }),
      ).toBe(expected);
    },
  );

  // The mobile layout gives up more room at the bottom of the screen than the
  // desktop one, so a short window only gains by it while it is phone-narrow.
  it("leaves a window that is short but far wider than a phone alone", async () => {
    expect(await isPhoneSized({ width: 1600, height: 430 })).toBe(false);
  });

  it.each([
    ["width", { width: 769, height: 900 }, { width: 768, height: 900 }],
    ["height", { width: 1000, height: 500 }, { width: 1000, height: 499 }],
    [
      "width a short screen may reach",
      { width: 1100, height: 430 },
      { width: 1099, height: 430 },
    ],
  ])("takes the %s up to its limit but not past it", async (_, over, under) => {
    expect(await isPhoneSized(over)).toBe(false);
    expect(await isPhoneSized(under)).toBe(true);
  });

  // the resize handler is the only thing keeping the height current, and every
  // other case here loads the module with the screen already at its size
  it("follows the screen as it turns", async () => {
    const { isPhoneSizedScreen } = await loadModule(1000, {}, 900);
    expect(isPhoneSizedScreen()).toBe(false);

    Object.defineProperty(window, "innerHeight", {
      value: 430,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event("resize"));

    expect(isPhoneSizedScreen()).toBe(true);
  });
});
