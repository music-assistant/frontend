// jsdom leaves var() unresolved in computed styles, so the values below are
// only observable under happy-dom
// @vitest-environment happy-dom
import shellSource from "@/components/CommandCenterShell.vue?raw";
import tokens from "@/styles/global.css?inline";
import css from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// happy-dom does no calc() arithmetic, so each token the sheet is sized from
// stands in as a plain literal. They are distinct, so a term going missing or
// landing on the wrong side reads as the wrong expression.
const NAV_HEIGHT = "111px";
const GAP = "7px";
const INSET_X = "9px";
const TOP_GAP = "33px";
const INSET_TOP = "55px";

let appStyles: HTMLStyleElement;
let tokenStyles: HTMLStyleElement;
let sheetStyles: HTMLStyleElement;

// vitest only compiles the stylesheets under src/styles, so the component's own
// rules are lifted straight out of its source.
function extractStyle(source: string) {
  return source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

// the classes the component hands the sheet, read off the template so the
// probe cannot drift from what it renders
function passedClasses() {
  const tag = shellSource.match(/<SheetContent[\s\S]*?>/)?.[0] ?? "";
  return tag.match(/\sclass="([^"]*)"/)?.[1] ?? "";
}

// SheetContent.vue's own classes for a bottom sheet, plus the ones it is passed
function sheet() {
  const element = document.createElement("div");
  element.className = `fixed inset-x-0 bottom-0 h-auto ${passedClasses()}`;
  document.body.appendChild(element);
  return element;
}

function normalize(value: string) {
  return value.replace(/\s+/g, "");
}

describe("mobile command center sheet", () => {
  beforeEach(() => {
    tokenStyles = document.createElement("style");
    tokenStyles.textContent = tokens;
    document.head.appendChild(tokenStyles);
    appStyles = document.createElement("style");
    appStyles.textContent = css;
    document.head.appendChild(appStyles);
    sheetStyles = document.createElement("style");
    sheetStyles.textContent = extractStyle(shellSource);
    document.head.appendChild(sheetStyles);

    for (const [token, value] of [
      ["--mobile-navigation-height", NAV_HEIGHT],
      ["--player-bar-popout-gap", GAP],
      ["--player-bar-popout-inset-x", INSET_X],
      ["--player-bar-popout-top-gap", TOP_GAP],
      ["--device-inset-top", INSET_TOP],
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

    expect(style.right).toBe(INSET_X);
    expect(style.left).toBe(INSET_X);
    expect(normalize(style.bottom)).toBe(`calc(${NAV_HEIGHT}+${GAP})`);
    expect(style.width).toBe("auto");
  });

  it("fills the room between the navigation and the status bar", () => {
    // the sheet keeps a fixed height rather than growing with its results, so
    // the ceiling is the whole of what it takes; the viewport it is measured
    // against reaches under the status bar, which the top inset clears
    expect(normalize(getComputedStyle(sheet()).height)).toBe(
      `calc(100dvh-${NAV_HEIGHT}-${GAP}-${TOP_GAP}-${INSET_TOP})`,
    );
  });
});
