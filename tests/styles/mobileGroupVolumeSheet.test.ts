// jsdom leaves var() unresolved in computed styles, so the values below are
// only observable under happy-dom, which in turn ignores @layer: the utilities
// only reach cssRules because the compiled stylesheet leaves them unlayered
// @vitest-environment happy-dom
import sheetSource from "@/layouts/default/PlayerOSD/PlayerBarMobileVolumeSheet.vue?raw";
import tokens from "@/styles/global.css?inline";
import css from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rank, utilityPriority } from "./cascade";

// happy-dom does no calc() arithmetic, and drops a position whose tokens expand
// to a nested one, so each token the sheet is placed from stands in as a plain
// literal. They are distinct, so no assertion can pass on a coincidence.
const NAV_HEIGHT = "111px";
const GAP = "7px";
const INSET_X = "9px";
const TOP_GAP = "33px";

// the equally-!important utilities the sheet and its backdrop carry, with the
// property each of them sets
const UTILITIES = [
  [".inset-x-0", "inset-inline"],
  [".bottom-0", "bottom"],
  [".inset-0", "inset"],
];

let appStyles: HTMLStyleElement;
let tokenStyles: HTMLStyleElement;
let sheetStyles: HTMLStyleElement;

// vitest only compiles the stylesheets under src/styles, so the component's own
// rules are lifted straight out of its source.
function extractStyle(source: string) {
  return source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

// the classes the component hands the sheet and its backdrop, read off the
// template so the probes cannot drift from what it renders
function passedClasses(attribute: string) {
  const tag = sheetSource.match(/<SheetContent[\s\S]*?>/)?.[0] ?? "";
  return tag.match(new RegExp(`\\s${attribute}="([^"]*)"`))?.[1] ?? "";
}

// happy-dom caches an element's computed style from its first read, so every
// case builds its probe after the tokens it measures are in place
function probe(className: string) {
  const element = document.createElement("div");
  element.className = className;
  document.body.appendChild(element);
  return element;
}

// SheetContent.vue's own classes for a bottom sheet, plus the ones it is passed
function sheet() {
  return probe(`fixed inset-x-0 bottom-0 h-auto ${passedClasses("class")}`);
}

// SheetOverlay.vue's backdrop, plus the class it is passed
function overlay() {
  return probe(
    `modal-backdrop fixed inset-0 ${passedClasses("overlay-class")}`,
  );
}

// the component's own rules that land on this element
function overrideRules(element: Element) {
  return [...(sheetStyles.sheet?.cssRules ?? [])]
    .filter((rule) => rule instanceof CSSStyleRule)
    .filter((rule) => element.matches(rule.selectorText));
}

function overridePriority(element: Element, property: string) {
  return overrideRules(element)
    .find((rule) => rule.style.getPropertyValue(property) !== "")
    ?.style.getPropertyPriority(property);
}

// which of two equally-!important declarations applies comes down to whichever
// stylesheet loads last, unless one of them out-ranks the other
function expectOutranks(element: Element, ...utilities: string[]) {
  const selectors = overrideRules(element).map((rule) => rule.selectorText);

  expect(selectors, "the component has to place this element").not.toHaveLength(
    0,
  );
  for (const selector of selectors) {
    for (const utility of utilities) {
      expect(
        rank(selector),
        `${selector} lands on this element, so it has to out-rank ${utility}: pair it with a second compound`,
      ).toBeGreaterThan(rank(utility));
    }
  }
}

// the declarations wrap at different points once the token names are in them,
// so compare them free of the source formatting
function normalize(value: string) {
  return value.replace(/\s+/g, "");
}

describe("mobile grouped volume sheet", () => {
  beforeEach(() => {
    tokenStyles = document.createElement("style");
    tokenStyles.textContent = tokens;
    document.head.appendChild(tokenStyles);
    appStyles = document.createElement("style");
    appStyles.textContent = css;
    document.head.appendChild(appStyles);
    sheetStyles = document.createElement("style");
    sheetStyles.textContent = extractStyle(sheetSource);
    document.head.appendChild(sheetStyles);

    for (const [token, value] of [
      ["--mobile-navigation-height", NAV_HEIGHT],
      ["--player-bar-popout-gap", GAP],
      ["--player-bar-popout-inset-x", INSET_X],
      ["--player-bar-popout-top-gap", TOP_GAP],
    ]) {
      document.documentElement.style.setProperty(token, value);
    }
  });

  afterEach(() => {
    sheetStyles.remove();
    appStyles.remove();
    tokenStyles.remove();
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  it("floats the sheet clear of the navigation and the sides", () => {
    const style = getComputedStyle(sheet());

    // the sides take the popouts' own inset, the bottom only clears the
    // navigation
    expect(style.right).toBe(INSET_X);
    expect(style.left).toBe(INSET_X);
    expect(normalize(style.bottom)).toBe(`calc(${NAV_HEIGHT}+${GAP})`);
    // it spans between those edges instead of keeping a width of its own
    expect(style.width).toBe("auto");
  });

  it("grows into the room left above the navigation", () => {
    // a sheet has no popper measuring the free space for it, so its ceiling is
    // composed from the tokens instead
    expect(normalize(getComputedStyle(sheet()).maxHeight)).toBe(
      `calc(100dvh-${NAV_HEIGHT}-${GAP}-${TOP_GAP})`,
    );
  });

  it("stops the backdrop above the navigation", () => {
    // the navigation stays reachable while the sheet is open, so the backdrop
    // must not cover it
    expect(getComputedStyle(overlay()).bottom).toBe(NAV_HEIGHT);
  });

  it("places both of them independently of the stylesheet load order", () => {
    // specificity only settles a tie within one importance level, so the
    // ranking below proves nothing unless both sides are !important
    for (const [utility, property] of UTILITIES) {
      expect(
        utilityPriority(appStyles, utility, property),
        "the Tailwind utilities import must stay `important` and unlayered",
      ).toBe("important");
    }
    // the sheet's own bottom is covered by its value instead: `.bottom-0` is a
    // longhand happy-dom does model, so losing !important there reads as 0px
    const stillWins = "the component's own placement has to stay !important";

    expect(overridePriority(sheet(), "right"), stillWins).toBe("important");
    expect(overridePriority(sheet(), "left"), stillWins).toBe("important");
    expect(overridePriority(overlay(), "bottom"), stillWins).toBe("important");

    expectOutranks(sheet(), ".inset-x-0", ".bottom-0");
    expectOutranks(overlay(), ".inset-0");
  });
});
