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

/**
 * Load a fresh breakpoint plugin for the given viewport width and user agent flags.
 */
async function loadBreakpoint(
  width: number,
  flags: Partial<UserAgentFlags> = {},
) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
  vi.resetModules();
  vi.doMock("@/helpers/device", () => ({ ...NO_FLAGS, ...flags }));
  return (await import("@/plugins/breakpoint")).getBreakpointValue;
}

afterEach(() => {
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
