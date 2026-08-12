// jsdom leaves var() unresolved in computed styles, so the values below are
// only observable under happy-dom, which in turn ignores @layer: the utilities
// only reach cssRules because the compiled stylesheet leaves them unlayered
// @vitest-environment happy-dom
import sheetSource from "@/layouts/default/PlayerOSD/PlayerBarMobileVolumeSheet.vue?raw";
import tokens from "@/styles/global.css?inline";
import css from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// happy-dom does no calc() arithmetic, and drops a position whose tokens expand
// to a nested one, so each token the sheet is placed from stands in as a plain
// literal. They are distinct, so no assertion can pass on a coincidence.
const NAV_HEIGHT = "111px";
const GAP = "7px";
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

// happy-dom caches an element's computed style from its first read, so every
// case builds its probe after the tokens it measures are in place
function probe(className: string) {
  const element = document.createElement("div");
  element.className = className;
  document.body.appendChild(element);
  return element;
}

// the classes SheetContent.vue composes for a bottom sheet, plus the ones the
// volume sheet passes it
function sheet() {
  return probe(
    "fixed inset-x-0 bottom-0 h-auto p-0 player-bar-popout mobile-group-volume-sheet",
  );
}

// SheetOverlay.vue's backdrop, with the class the volume sheet passes it
function overlay() {
  return probe("modal-backdrop fixed inset-0 mobile-group-volume-overlay");
}

function utilityPriority(selector: string, property: string) {
  return [...(appStyles.sheet?.cssRules ?? [])]
    .filter((rule) => rule instanceof CSSStyleRule)
    .find((rule) => rule.selectorText === selector)
    ?.style.getPropertyPriority(property);
}

// the component's own selectors that land on this element
function overrideSelectors(element: Element) {
  return [...(sheetStyles.sheet?.cssRules ?? [])]
    .filter((rule) => rule instanceof CSSStyleRule)
    .map((rule) => rule.selectorText)
    .filter((selector) => element.matches(selector));
}

// happy-dom takes the last of two !important declarations rather than the most
// specific one, so the rank the component's selectors buy is only observable
// off the selectors themselves. Neither side carries an id or an element name,
// so counting their class-level compounds is the whole comparison.
function rank(selector: string) {
  return (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length;
}

// which of two equally-!important declarations applies comes down to whichever
// stylesheet loads last, unless one of them out-ranks the other
function expectOutranks(element: Element, ...utilities: string[]) {
  const selectors = overrideSelectors(element);

  expect(selectors, "the component has to place this element").not.toHaveLength(
    0,
  );
  for (const selector of selectors) {
    for (const utility of utilities) {
      expect(
        rank(selector),
        `${selector} has to out-rank ${utility}`,
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

    expect(style.right).toBe(GAP);
    expect(style.left).toBe(GAP);
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
    // the placements only prove anything while the utilities they have to
    // out-rank are themselves !important
    for (const [utility, property] of UTILITIES) {
      expect(
        utilityPriority(utility, property),
        "the Tailwind utilities import must stay `important` and unlayered",
      ).toBe("important");
    }

    expectOutranks(sheet(), ".inset-x-0", ".bottom-0");
    expectOutranks(overlay(), ".inset-0");
  });
});
