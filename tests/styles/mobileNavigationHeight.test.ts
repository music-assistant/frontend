// jsdom leaves var() unresolved in computed styles, so this composition is only
// observable under happy-dom, which in turn ignores @layer: the comparison holds
// because both rules are unlayered in the compiled stylesheet
// @vitest-environment happy-dom
import navigationSource from "@/components/navigation/BottomNavigation.vue?raw";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import tokens from "@/styles/global.css?inline";
import utilities from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { utilityPriority } from "./cascade";

// Read off the template rather than copied, so a class the rules key on going
// missing fails here instead of leaving the probe measuring rules the bar no
// longer carries.
function templateClasses(pattern: RegExp) {
  const classes = navigationSource.match(pattern)?.[1];
  if (!classes)
    throw new Error(`the template carries no class list for ${pattern}`);
  return classes;
}

const BAR_CLASSES = templateClasses(/<nav[\s\S]*?\sclass="([^"]*)"/);
// every button in the bar is one of its items, so each is measured in turn: a
// single one dropping the class the height rules key on leaves that button at
// the size its own variant gives it. A Button merges the classes it is passed
// onto its own, and its size is where that competing height comes from.
const ITEM_CLASS_LISTS = [
  ...navigationSource.matchAll(/<Button[\s\S]*?\sclass="([^"]*)"/g),
].map(([, classes]) => cn(buttonVariants({ variant: "ghost" }), classes));
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

describe("mobile navigation height", () => {
  beforeEach(() => {
    styles = [tokens, extractStyle(navigationSource)].map((text) => {
      const element = document.createElement("style");
      element.textContent = text;
      document.head.appendChild(element);
      return element;
    });
    // last, so the utilities win every tie the bar's own rules do not break.
    // The app loads them the other way round - the bar's styles ship in a chunk
    // pulled in after the entry sheet - so this is the harder order, and the only
    // one in which the bar out-ranking a utility is visible at all.
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
      ITEM_CLASS_LISTS.length,
      "the bar must hold buttons to measure",
    ).toBeGreaterThan(0);
    for (const classes of ITEM_CLASS_LISTS) {
      expect(
        probe(classes).height,
        `the button "${classes}" must take the height the bar does`,
      ).toBe(ITEM_HEIGHT);
    }
  });

  it("lifts the bar clear of the screen edge by the published inset", () => {
    // the offset only proves anything while the utility it has to out-rank is
    // itself !important
    expect(
      utilityPriority(utilityStyles, ".bottom-0", "bottom"),
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

  it("takes its clearance from the inset the host can zero", () => {
    document.documentElement.setAttribute("data-embedded-layout", "");

    // embedded the device insets are the host's to add, so the bar zeroes them
    // and falls back on the floor under the inset. Reaching for the device inset
    // directly reads the same until it is embedded, and then reserves the home
    // indicator a second time on top of the host's own room. A host that hands
    // the safe area over writes the same properties inline, and the bar follows
    // them there without reading anything else.
    expect(customProperty("--mobile-navigation-height")).toBe(
      "calc(72px+max(12px,calc(0px*0.65)))",
    );
  });
});
