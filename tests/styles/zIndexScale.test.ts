import { describe, expect, it } from "vitest";

// Below this, a z-index only orders elements inside a component's own
// stacking context and is unrelated to the app-wide scale in global.css.
const GLOBAL_BAND_FLOOR = 900;

// The "Stacking order for anything pinned to the screen" block in
// src/styles/global.css.
const DOCUMENTED_BANDS = [
  996, 997, 998, 999, 1000, 2000, 2001, 2100, 9000, 9001, 9002, 9999, 10000,
  10001, 100000, 100001, 999999,
];

// z-index is declared in five syntaxes across the app. Requiring `:` or `=`
// right after the property name keeps comment prose ("the overlay z-index
// inline", "a dialog at z-index 9000") from reading as a declaration, and the
// lookbehind keeps `--z-index` custom properties out.
const PATTERNS = [
  /(?<!-)z-index\s*[:=]\s*"?(\d+)/g, // CSS declaration, template attr, bound prop
  /!?z-\[(\d+)\]/g, // Tailwind arbitrary utility
  /zIndex\s*:\s*(\d+)/g, // JS/TS object property
];

const sources = import.meta.glob("../../src/**/*.{vue,ts,css}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function scanGlobalBand() {
  const offenders: { value: number; file: string }[] = [];
  const found = new Set<number>();

  for (const [path, content] of Object.entries(sources)) {
    const file = path.replace("../../", "");
    for (const pattern of PATTERNS) {
      for (const match of content.matchAll(pattern)) {
        const value = Number(match[1]);
        if (value < GLOBAL_BAND_FLOOR) continue;
        found.add(value);
        if (!DOCUMENTED_BANDS.includes(value)) offenders.push({ value, file });
      }
    }
  }

  return { offenders, found };
}

describe("z-index global scale", () => {
  it("documents every z-index used in the global band", () => {
    const { offenders } = scanGlobalBand();

    expect(
      offenders,
      offenders
        .map(
          ({ value, file }) =>
            `${file} declares z-index ${value}, which isn't in the documented ` +
            `scale. Add it to the "Stacking order" block in src/styles/global.css, ` +
            `or reuse an existing band.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("finds every documented band in src/", () => {
    // also guards against a broken pattern above silently matching nothing
    const { found } = scanGlobalBand();
    const missing = DOCUMENTED_BANDS.filter((value) => !found.has(value));

    expect(
      missing,
      `${missing.join(", ")} no longer occurs in src/. Drop it from the ` +
        `"Stacking order" block in src/styles/global.css, unless the patterns ` +
        `above stopped matching how it is declared.`,
    ).toEqual([]);
  });
});
