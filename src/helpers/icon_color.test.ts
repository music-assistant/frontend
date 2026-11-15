import { getIconColor } from "@/helpers/icon_color";
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
