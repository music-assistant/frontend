// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom, which in turn ignores @layer: the comparison
// holds because both rules are unlayered in the compiled stylesheet
// @vitest-environment happy-dom
import css from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERLAY_HEIGHT = "--player-bar-overlay-height";
const OVERLAY_MARKER = "data-player-bar-overlay";
const BAR_HEIGHT = "72px";

let appStyles: HTMLStyleElement;

// happy-dom caches an element's computed style from its first read, so every
// case builds its popout after the document state it measures is in place
function popoutInset() {
  const popout = document.createElement("div");
  // the p-0 every popout passes compiles to an !important padding reset
  popout.className = "player-bar-popout p-0";
  document.body.appendChild(popout);
  return getComputedStyle(popout).paddingBottom;
}

function utilityPaddingPriority() {
  const rules = [...(appStyles.sheet?.cssRules ?? [])] as CSSStyleRule[];
  return rules
    .find((rule) => rule.selectorText === ".p-0")
    ?.style.getPropertyPriority("padding");
}

describe("player bar popout inset", () => {
  beforeEach(() => {
    appStyles = document.createElement("style");
    appStyles.textContent = css;
    document.head.appendChild(appStyles);
  });

  afterEach(() => {
    appStyles.remove();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute(OVERLAY_MARKER);
    document.documentElement.style.removeProperty(OVERLAY_HEIGHT);
  });

  it("clears the player bar while the mobile bar is on screen", () => {
    // the inset only proves anything while it still has to out-rank the
    // utility, which the important-flagged Tailwind import makes a real contest
    expect(utilityPaddingPriority()).toBe("important");

    document.documentElement.setAttribute(OVERLAY_MARKER, "");
    document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);

    expect(popoutInset()).toBe(BAR_HEIGHT);
  });

  it("leaves popouts untouched without the player bar", () => {
    expect(popoutInset()).toBe("0px");
  });
});
