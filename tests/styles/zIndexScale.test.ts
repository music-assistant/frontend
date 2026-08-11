import globalCss from "@/styles/global.css?inline";
import { describe, expect, it } from "vitest";

// Below this, a z-index orders elements inside a component's own stacking
// context rather than against the app-wide scale.
const GLOBAL_BAND_FLOOR = 900;

// z-index reaches the DOM through five syntaxes here: CSS declarations, Vue
// attributes and bound props, JS object properties, and Tailwind's two forms
// (`z-[998]` and the bare `z-998`, which v4 compiles just the same). Requiring
// `:` or `=` right after the property name skips the surrounding prose that
// mentions a band without setting it, and the lookbehind keeps the `--z-index`
// custom properties in PartyTrackCard out.
const PATTERNS = [
  /(?<!-)z-index\s*[:=]\s*"?(\d+)/g,
  /zIndex\s*:\s*"?(\d+)/g,
  /(?<![\w-])!?-?z-\[(\d+)\]/g,
  /(?<![\w-])!?-?z-(\d+)(?![\w-])/g,
];

const sources = import.meta.glob("../../src/**/*.{vue,ts,css,scss}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Read back from the comment block itself, so what this asserts against is the
// documentation rather than a copy of it that could drift.
function documentedBands() {
  const block = globalCss.match(
    /Stacking order for anything pinned[\s\S]*?\*\//,
  )?.[0];
  if (!block) throw new Error("scale block not found in src/styles/global.css");

  return [...block.matchAll(/^\s*(\d{3,})\s{2,}\S/gm)].map(([, band]) =>
    Number(band),
  );
}

function scanGlobalBand(bands: number[]) {
  const offenders = new Map<string, { value: number; file: string }>();
  const found = new Set<number>();

  for (const [path, content] of Object.entries(sources)) {
    const file = path.replace("../../", "");
    for (const pattern of PATTERNS) {
      for (const match of content.matchAll(pattern)) {
        const value = Number(match[1]);
        if (value < GLOBAL_BAND_FLOOR) continue;
        found.add(value);
        if (!bands.includes(value)) {
          offenders.set(`${file}:${value}`, { value, file });
        }
      }
    }
  }

  return { offenders: [...offenders.values()], found };
}

describe("z-index global scale", () => {
  it("documents every z-index used in the global band", () => {
    const { offenders } = scanGlobalBand(documentedBands());

    expect(
      offenders,
      offenders
        .map(
          ({ value, file }) =>
            `${file} declares z-index ${value}, which the scale in ` +
            `src/styles/global.css does not list. Give it a line there, or ` +
            `reuse the band that describes it.`,
        )
        .join("\n"),
    ).toEqual([]);
  });

  it("finds every documented band in src/", () => {
    // also catches a pattern above quietly matching nothing at all
    const bands = documentedBands();
    const { found } = scanGlobalBand(bands);
    const missing = bands.filter((band) => !found.has(band));

    expect(
      missing,
      `nothing in src/ uses ${missing.join(", ")} any more. Drop it from the ` +
        `scale in src/styles/global.css, unless the patterns above stopped ` +
        `matching how it is written.`,
    ).toEqual([]);
  });
});
