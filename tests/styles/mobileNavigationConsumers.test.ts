// jsdom leaves var() unresolved in computed styles, so these placements are only
// observable under happy-dom, which in turn ignores @layer: the comparisons hold
// because every rule involved is unlayered in the compiled stylesheet
// @vitest-environment happy-dom
import footerSource from "@/layouts/default/Footer.vue?raw";
import groupControlSource from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue?raw";
import playerSelectSource from "@/layouts/default/PlayerSelect.vue?raw";
import viewSource from "@/layouts/default/View.vue?raw";
import tokens from "@/styles/global.css?inline";
import utilities from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// The bar's height is composed from two tokens, and happy-dom neither evaluates
// calc() nor keeps a declaration whose value expands to a nested one, so it
// stands in here as a plain literal. It is deliberately not what those tokens
// add up to, so a call site that hardcodes the room the bar takes, or measures
// it from a different token, reads as something else and fails.
const NAV_HEIGHT = "83px";
// the room the scroll padding leaves above the bar for the floating player
// card. Unlike the height above, this is the literal the rule really adds.
const PLAYER_CLEARANCE = "162px";

// the backdrops behind the two player bar popouts, each of which has to stop
// short of the navigation
const BACKDROPS = [
  ["the player select popout", playerSelectSource],
  ["the group control popout", groupControlSource],
] as const;

let styles: HTMLStyleElement[];

// vitest only compiles the stylesheets under src/styles, so a component's own
// rules are lifted straight out of its source. View's block is scoped, which
// only adds an attribute to each of its selectors: its rules keep their values
// and their order relative to one another, so the probes read the same.
function extractStyle(source: string, name: string) {
  const style = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1];
  if (!style) throw new Error(`${name} no longer ships a <style> block`);
  return style;
}

// The classes an element wears in the mobile layout, read off the template so a
// rule the component has stopped applying, or now applies in some other layout,
// fails here instead of being measured on a probe nothing in the app wears. The
// modifier is found by the condition that picks it rather than by its name, in
// the two shapes these templates use: a ternary branch and a conditional object
// key. A backdrop may replace it with a branch of its own further up, which is
// that branch's business rather than this one's.
function mobileClasses(source: string, anchor: string, name: string) {
  const binding = [...source.matchAll(/:class="\[([\s\S]*?)\]"/g)]
    .map(([, body]) => body)
    .find((body) => body.includes(anchor));
  if (!binding)
    throw new Error(`${name} no longer binds a class list for "${anchor}"`);

  const shared = [...binding.matchAll(/'([^']*)'/g)]
    .map(([, value]) => value)
    .find((entry) => entry.includes(anchor));
  const modifier =
    binding.match(/store\.mobileLayout\s*\?\s*'([^']+)'/)?.[1] ??
    binding.match(/'([^']+)'\s*:\s*store\.mobileLayout/)?.[1];
  if (!shared) throw new Error(`${name} no longer applies "${anchor}"`);
  if (!modifier)
    throw new Error(`${name} no longer takes this offset from the layout`);
  return { shared, modifier };
}

// The footer places itself from a style binding rather than a rule, so the
// value it binds is lifted out of the template and measured on its own. As
// above, the branch is taken from the condition that picks it.
function footerMobileBottom() {
  const bottom = footerSource
    .match(/:style="\{([\s\S]*?)\}"/)?.[1]
    .match(/bottom:\s*store\.mobileLayout\s*\?\s*'([^']*)'/)?.[1];
  if (!bottom)
    throw new Error("the footer no longer takes its bottom from the layout");
  return bottom;
}

// happy-dom caches an element's computed style from its first read, so every
// probe is built after the custom properties it measures are in place
function probe(className: string) {
  const element = document.createElement("div");
  element.className = className;
  document.body.appendChild(element);
  return getComputedStyle(element);
}

function probeOffsetBy(bottom: string) {
  const element = document.createElement("div");
  element.style.bottom = bottom;
  document.body.appendChild(element);
  return getComputedStyle(element).bottom;
}

// the declarations wrap at different points as the token names change, so
// compare them free of the source formatting
function normalize(value: string) {
  return value.replace(/\s+/g, "");
}

describe("mobile navigation height consumers", () => {
  beforeEach(() => {
    styles = [
      // the padding the scroll container's mobile modifier replaces is composed
      // from a device inset, so the tokens are here for it to resolve the way
      // it does in the app
      tokens,
      extractStyle(viewSource, "the layout"),
      extractStyle(playerSelectSource, "the player select"),
      extractStyle(groupControlSource, "the group control"),
      // the backdrops are taken out of the flow by a utility rather than by
      // their own rules, so those have to be here too
      utilities,
    ].map((text) => {
      const element = document.createElement("style");
      element.textContent = text;
      document.head.appendChild(element);
      return element;
    });

    document.documentElement.style.setProperty(
      "--mobile-navigation-height",
      NAV_HEIGHT,
    );
  });

  afterEach(() => {
    styles.forEach((element) => element.remove());
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  it("keeps scrolled content clear of the navigation and the player", () => {
    const { shared, modifier } = mobileClasses(
      viewSource,
      "content-section",
      "the layout",
    );

    // the last thing in a list is otherwise left stranded behind the bar, with
    // nothing below it to scroll up into view
    expect(normalize(probe(`${shared} ${modifier}`).paddingBottom)).toBe(
      `calc(${NAV_HEIGHT}+${PLAYER_CLEARANCE})`,
    );
  });

  it("stops the popout backdrops above the navigation", () => {
    for (const [name, source] of BACKDROPS) {
      const { shared, modifier } = mobileClasses(
        source,
        "modal-backdrop",
        `${name}'s backdrop`,
      );
      const backdrop = probe(`${shared} ${modifier}`);

      // the navigation stays reachable while a popout is open, so a backdrop
      // that swallowed the taps meant for it would strand the user in the
      // popout with only its own dismissal left
      expect(
        backdrop.bottom,
        `${name}'s backdrop has to stop above the navigation`,
      ).toBe(NAV_HEIGHT);
      // an offset means nothing until something takes the backdrop out of the
      // flow
      expect(backdrop.position).toBe("fixed");
    }
  });

  it("sits the mobile player bar directly on the navigation", () => {
    // the two are stacked rather than overlaid, and the scrim and the popouts
    // above them are placed from the pair's combined height, so a player bar
    // that sat anywhere else would leave a gap they do not account for
    expect(probeOffsetBy(footerMobileBottom())).toBe(NAV_HEIGHT);
  });
});
