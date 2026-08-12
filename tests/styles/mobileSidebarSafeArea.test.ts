// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom, which in turn ignores @layer: the comparison
// holds because both rules are unlayered in the compiled stylesheet
// @vitest-environment happy-dom
import sidebarSource from "@/components/ui/sidebar/Sidebar.vue?raw";
import tokens from "@/styles/global.css?inline";
import css from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const INSET_TOP = "44px";
const INSET_BOTTOM = "34px";
const INSET_SIDE = "59px";
// stands in for SIDEBAR_WIDTH_MOBILE, in px so the expected width stays legible
const MENU_WIDTH = "288px";

let appStyles: HTMLStyleElement;
let tokenStyles: HTMLStyleElement;
let sheetStyles: HTMLStyleElement;

// Use raw selectors so the test does not depend on Vue's generated scope id.
function extractStyle(source: string) {
  return source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

// happy-dom caches an element's computed style from its first read, so every
// case builds its panel after the insets it measures are in place
function panel(side: "left" | "right") {
  const sheet = document.createElement("div");
  // the classes Sidebar.vue and SheetContent.vue put on the mobile sheet
  sheet.className = [
    "sidebar-mobile-sheet",
    `sidebar-mobile-sheet--${side}`,
    "w-(--sidebar-width)",
    "p-0",
    "top-0",
    "bottom-0",
    side === "left" ? "left-0" : "right-0",
    side === "left" ? "rounded-r-md" : "rounded-l-md",
  ].join(" ");
  sheet.style.setProperty("--sidebar-width", MENU_WIDTH);
  document.body.appendChild(sheet);
  return getComputedStyle(sheet);
}

function utilityPriority(selector: string, property: string) {
  return [...(appStyles.sheet?.cssRules ?? [])]
    .filter((rule) => rule instanceof CSSStyleRule)
    .find((rule) => rule.selectorText === selector)
    ?.style.getPropertyPriority(property);
}

describe("mobile sidebar safe area", () => {
  beforeEach(() => {
    tokenStyles = document.createElement("style");
    tokenStyles.textContent = tokens;
    document.head.appendChild(tokenStyles);
    appStyles = document.createElement("style");
    appStyles.textContent = css;
    document.head.appendChild(appStyles);
    sheetStyles = document.createElement("style");
    sheetStyles.textContent = extractStyle(sidebarSource);
    document.head.appendChild(sheetStyles);

    for (const [side, inset] of [
      ["top", INSET_TOP],
      ["bottom", INSET_BOTTOM],
      ["left", INSET_SIDE],
      ["right", INSET_SIDE],
    ]) {
      document.documentElement.style.setProperty(
        `--device-inset-${side}`,
        inset,
      );
    }
  });

  afterEach(() => {
    sheetStyles.remove();
    appStyles.remove();
    tokenStyles.remove();
    document.body.innerHTML = "";
    for (const side of ["top", "right", "bottom", "left"]) {
      document.documentElement.style.removeProperty(`--device-inset-${side}`);
    }
  });

  it("reaches the edges of the screen", () => {
    const sheet = panel("left");

    // the surface has to fill the strips the phone keeps for the status bar and
    // the home indicator, or the menu reads as cut off against the page
    expect(sheet.top).toBe("0px");
    expect(sheet.bottom).toBe("0px");
    expect(sheet.left).toBe("0px");
    expect(sheet.borderRadius).toBe("0px");
  });

  it("holds the menu clear of the phone's controls", () => {
    // the padding only proves anything while the utility it has to out-rank is
    // itself !important
    expect(
      utilityPriority(".p-0", "padding"),
      "the Tailwind utilities import must stay `important` and unlayered",
    ).toBe("important");

    const sheet = panel("left");

    expect(sheet.paddingTop).toBe(INSET_TOP);
    expect(sheet.paddingBottom).toBe(INSET_BOTTOM);
    expect(sheet.paddingLeft).toBe(INSET_SIDE);
    // the inner edge is nowhere near a device inset
    expect(sheet.paddingRight).toBe("0px");
  });

  it("keeps the menu its full width beside a horizontal inset", () => {
    expect(
      utilityPriority(".w-\\(--sidebar-width\\)", "width"),
      "the Tailwind utilities import must stay `important` and unlayered",
    ).toBe("important");

    // happy-dom does not evaluate calc(), so the width is only observable as
    // the expression it composes: the panel carries the padding on top of the
    // width the menu itself needs
    expect(panel("left").width).toBe(`calc(${MENU_WIDTH} + ${INSET_SIDE})`);
  });

  it("mirrors the inset it pads when the menu opens from the right", () => {
    const sheet = panel("right");

    expect(sheet.right).toBe("0px");
    expect(sheet.paddingRight).toBe(INSET_SIDE);
    expect(sheet.paddingLeft).toBe("0px");
    expect(sheet.width).toBe(`calc(${MENU_WIDTH} + ${INSET_SIDE})`);
  });

  it("leaves the menu untouched where the host owns the insets", () => {
    // the embedded layout zeroes every inset, so the panel has to come out
    // exactly as it was before any of this padding existed
    document.documentElement.setAttribute("data-embedded-layout", "");
    for (const side of ["top", "right", "bottom", "left"]) {
      document.documentElement.style.removeProperty(`--device-inset-${side}`);
    }

    const sheet = panel("left");

    expect(sheet.padding).toBe("0px");
    expect(sheet.width).toBe(`calc(${MENU_WIDTH} + 0px)`);
    document.documentElement.removeAttribute("data-embedded-layout");
  });
});
