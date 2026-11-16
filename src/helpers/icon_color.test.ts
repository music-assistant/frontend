import { getIconColor, isDrawnInWhite } from "@/helpers/icon_color";
import { describe, expect, it } from "vitest";

const base64Svg = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;
const textSvg = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

describe("getIconColor", () => {
  it("reads the one clear colour of an svg", () => {
    expect(
      getIconColor(
        base64Svg(
          '<svg><rect fill="#1DB954"/><path fill="#ffffff"/><path fill="#000"/></svg>',
        ),
      ),
    ).toBe("#1db954");
  });

  it("takes the most used colour, from attributes, styles and gradient stops", () => {
    expect(
      getIconColor(
        textSvg(
          '<svg><stop stop-color="#e53935"/><path style="fill:#3949ab"/>' +
            '<path fill="rgb(57, 73, 171)"/><circle fill="#e53935"/>' +
            '<circle style="fill: #3949AB"/></svg>',
        ),
      ),
    ).toBe("#3949ab");
  });

  it("reads the colour of an icon drawn in strokes", () => {
    expect(
      getIconColor(textSvg('<svg><path fill="none" stroke="#e53935"/></svg>')),
    ).toBe("#e53935");
  });

  it("finds nothing in an svg of only black, white and grey", () => {
    expect(
      getIconColor(
        base64Svg(
          '<svg><path fill="#000000"/><path fill="#fff"/><path fill="#808080"/>' +
            '<path fill="#fafafa"/><path fill="#111"/></svg>',
        ),
      ),
    ).toBeNull();
  });

  it("finds nothing in an svg without fills", () => {
    expect(getIconColor("data:image/svg+xml;base64,PHN2Zy8+")).toBeNull();
  });

  it("does not read an image that is not an svg", () => {
    expect(getIconColor("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
  });

  it("reads an svg full of unclosed colours quickly", () => {
    const svg = base64Svg(
      `<svg>${'<path fill="rgb(12 34 56 '.repeat(12_000)}</svg>`,
    );
    const started = performance.now();

    expect(getIconColor(svg)).toBeNull();
    // a pattern that scans the rest of the text for every fill takes seconds
    expect(performance.now() - started).toBeLessThan(250);
  });

  it.each([
    ["broken base64", "data:image/svg+xml;base64,%%%not base64"],
    ["a broken escape", "data:image/svg+xml,%E0%A4%A"],
    ["a link instead of data", "https://example.org/icon.svg"],
    ["a colour that is not one", base64Svg('<svg fill="#12345"/>')],
    ["an empty string", ""],
    ["nothing", null],
    ["undefined", undefined],
  ])("finds nothing without throwing for %s", (_name, input) => {
    expect(getIconColor(input)).toBeNull();
  });
});

describe("isDrawnInWhite", () => {
  it.each([
    ["white only, in a style", '<svg><path style="fill:#ffffff"/></svg>', true],
    [
      "white fills, strokes and stops",
      '<svg><stop stop-color="#FFF"/><path fill="white" stroke="rgb(250, 250, 250)"/></svg>',
      true,
    ],
    [
      "white with a colour",
      '<svg><path fill="#fff"/><circle fill="#1DB954"/></svg>',
      false,
    ],
    [
      "white with black stated",
      '<svg><path fill="#fff"/><path stroke="black"/></svg>',
      false,
    ],
    ["no colour stated", '<svg><path d="M0 0h1v1z"/></svg>', false],
    [
      "only a reference",
      '<svg><path fill="url(#g)" stroke="none"/></svg>',
      false,
    ],
  ])("answers for an svg of %s", (_name, svg, white) => {
    expect(isDrawnInWhite(base64Svg(svg))).toBe(white);
    expect(isDrawnInWhite(textSvg(svg))).toBe(white);
  });

  it("does not read an image that is not an svg, or nothing", () => {
    expect(isDrawnInWhite("data:image/png;base64,iVBORw0KGgo=")).toBe(false);
    expect(isDrawnInWhite("data:image/svg+xml;base64,%%%")).toBe(false);
    expect(isDrawnInWhite(null)).toBe(false);
  });

  it("reads an svg full of unclosed colours quickly", () => {
    const svg = base64Svg(
      `<svg>${'<path stroke="rgb(250 250 250 '.repeat(12_000)}</svg>`,
    );
    const started = performance.now();

    expect(isDrawnInWhite(svg)).toBe(false);
    // a pattern that scans the rest of the text for every stroke takes seconds
    expect(performance.now() - started).toBeLessThan(250);
  });
});
