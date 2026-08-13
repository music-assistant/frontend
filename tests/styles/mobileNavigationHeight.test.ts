// jsdom leaves var() unresolved in computed styles, so this composition is only
// observable under happy-dom, which in turn ignores @layer: the comparison holds
// because both rules are unlayered in the compiled stylesheet
// @vitest-environment happy-dom
import navigationSource from "@/components/navigation/BottomNavigation.vue?raw";
import tokens from "@/styles/global.css?inline";
import utilities from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// the class list the bar carries in the template, so the utilities it has to
// out-rank are in play here the same way they are on screen
const BAR_CLASSES =
  "mobile-bottom-navigation fixed inset-x-0 bottom-0 z-[2000] flex";
const ITEM_CLASSES = "player-control-button mobile-navigation-item";
// deliberately not the real values, so a bar that hardcodes its own geometry
// instead of reading the tokens fails here
const ITEM_HEIGHT = "71px";
const INSET_BOTTOM = "17px";

let styles: HTMLStyleElement[];
let utilityStyles: HTMLStyleElement;

// the block is unscoped, so the selectors it declares are the shipped ones. A
// block that stops matching is compiled differently and no longer says what the
// bar ships, so say that rather than measuring an empty stylesheet.
function extractStyle(source: string) {
  const style = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  if (!style) throw new Error("the navigation's plain <style> block is gone");
  return style;
}

// happy-dom substitutes every var() but does not evaluate calc(), so the height
// is only observable as the expression it composes. The declarations wrap at
// different points as the token names change, so compare them free of the
// source formatting.
function customProperty(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .replace(/\s+/g, "");
}

// happy-dom caches an element's computed style from its first read, so each
// probe is built after the custom properties it measures are in place
function probe(className: string) {
  const element = document.createElement("div");
  element.className = className;
  document.body.appendChild(element);
  return getComputedStyle(element);
}

function utilityBottomPriority() {
  return [...(utilityStyles.sheet?.cssRules ?? [])]
    .filter((rule) => rule instanceof CSSStyleRule)
    .find((rule) => rule.selectorText === ".bottom-0")
    ?.style.getPropertyPriority("bottom");
}

describe("mobile navigation height", () => {
  beforeEach(() => {
    styles = [tokens, extractStyle(navigationSource)].map((text) => {
      const element = document.createElement("style");
      element.textContent = text;
      document.head.appendChild(element);
      return element;
    });
    // last, so the utilities win every tie the bar's own rules do not break.
    // That is the order the bar is written to survive, and the only one in which
    // dropping its :root guard is visible.
    utilityStyles = document.createElement("style");
    utilityStyles.textContent = utilities;
    document.head.appendChild(utilityStyles);
    styles.push(utilityStyles);
  });

  afterEach(() => {
    styles.forEach((element) => element.remove());
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-embedded-layout");
    document.body.innerHTML = "";
  });

  it("sizes the bar and its buttons from one height", () => {
    document.documentElement.style.setProperty(
      "--mobile-navigation-item-height",
      ITEM_HEIGHT,
    );

    // the bar is only a track for the buttons, so a bar taller than the buttons
    // it holds leaves them floating off the surface behind them
    expect(probe(BAR_CLASSES).height).toBe(ITEM_HEIGHT);
    expect(
      probe(ITEM_CLASSES).height,
      "the buttons must take the same height the bar does",
    ).toBe(ITEM_HEIGHT);
  });

  it("lifts the bar clear of the screen edge by the published inset", () => {
    // the offset only proves anything while the utility it has to out-rank is
    // itself !important
    expect(
      utilityBottomPriority(),
      "the Tailwind utilities import must stay `important` and unlayered",
    ).toBe("important");

    // happy-dom drops a declaration whose substituted custom property expands to
    // a max(), so the bar is measured with its inset flattened to a literal
    document.documentElement.style.setProperty(
      "--mobile-navigation-inset-bottom",
      INSET_BOTTOM,
    );
    const bar = probe(BAR_CLASSES);

    // the inset is what holds the bar off the home indicator, and the bar's own
    // bottom-0 would otherwise drop it flat against the edge of the screen
    expect(bar.bottom).toBe(INSET_BOTTOM);
    // an offset means nothing until something takes the bar out of the flow
    expect(bar.position).toBe("fixed");
  });

  it("adds up to the height everything else is positioned from", () => {
    document.documentElement.style.setProperty(
      "--mobile-navigation-item-height",
      ITEM_HEIGHT,
    );
    document.documentElement.style.setProperty(
      "--mobile-navigation-inset-bottom",
      INSET_BOTTOM,
    );

    // the bar takes its own two measurements straight from the tokens, and the
    // sheets, popovers, player bar and scroll padding above it all measure from
    // this instead. Nothing lines the two up at runtime, so this is what catches
    // the room the bar occupies drifting from the room everything else leaves it.
    expect(customProperty("--mobile-navigation-height")).toBe(
      `calc(${ITEM_HEIGHT}+${INSET_BOTTOM})`,
    );
  });

  it("still occupies the floor of that height when the host owns the insets", () => {
    document.documentElement.setAttribute("data-embedded-layout", "");

    // embedded in Home Assistant the device insets are the host's to add, so the
    // bar zeroes them. What is left is the floor under the inset, which is what
    // holds the buttons clear of the bottom of the panel.
    expect(customProperty("--mobile-navigation-height")).toBe(
      "calc(72px+max(12px,calc(0px*0.65)))",
    );
  });
});
