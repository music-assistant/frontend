// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom, which in turn ignores @layer: the comparison
// holds because both rules are unlayered in the compiled stylesheet
// @vitest-environment happy-dom
import groupControlSource from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue?raw";
import volumeControlSource from "@/layouts/default/PlayerOSD/PlayerBarVolumeControl.vue?raw";
import playerSelectSource from "@/layouts/default/PlayerSelect.vue?raw";
import {
  PLAYER_BAR_POPOUT_COLLISION_PADDING,
  PLAYER_BAR_POPOUT_GAP,
  PLAYER_BAR_POPOUT_INSET_X,
} from "@/helpers/player_bar";
import tokens from "@/styles/global.css?inline";
import css from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERLAY_HEIGHT = "--player-bar-overlay-height";
const OVERLAY_MARKER = "data-player-bar-overlay";
const BAR_HEIGHT = "72px";
const DOCK_RIM = "4px";

let appStyles: HTMLStyleElement;
let tokenStyles: HTMLStyleElement;

// happy-dom caches an element's computed style from its first read, so every
// case builds its popout after the document state it measures is in place
function popoutInset() {
  const popout = document.createElement("div");
  // the p-0 every popout passes compiles to an !important padding reset
  popout.className = "player-bar-popout p-0";
  document.body.appendChild(popout);
  return getComputedStyle(popout).paddingBottom;
}

function customProperty(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function utilityPaddingPriority() {
  return [...(appStyles.sheet?.cssRules ?? [])]
    .filter((rule) => rule instanceof CSSStyleRule)
    .find((rule) => rule.selectorText === ".p-0")
    ?.style.getPropertyPriority("padding");
}

describe("player bar popout inset", () => {
  beforeEach(() => {
    // the inset composes the dock rim the tokens declare, so both sheets have
    // to be in place for it to resolve
    tokenStyles = document.createElement("style");
    tokenStyles.textContent = tokens;
    document.head.appendChild(tokenStyles);
    appStyles = document.createElement("style");
    appStyles.textContent = css;
    document.head.appendChild(appStyles);
  });

  afterEach(() => {
    appStyles.remove();
    tokenStyles.remove();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute(OVERLAY_MARKER);
    document.documentElement.style.removeProperty(OVERLAY_HEIGHT);
  });

  it("clears the whole dock while the mobile bars are on screen", () => {
    // the inset only proves anything while the utility it has to out-rank is
    // itself !important
    expect(
      utilityPaddingPriority(),
      "the Tailwind utilities import must stay `important` and unlayered",
    ).toBe("important");

    document.documentElement.setAttribute(OVERLAY_MARKER, "");
    document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);

    // the dock's surface reaches past the player card it carries, so clearing
    // the card alone would leave the popouts hovering over its rim
    expect(popoutInset().replace(/\s+/g, " ")).toBe(
      `calc( ${BAR_HEIGHT} + ${DOCK_RIM} )`,
    );
  });

  it("leaves popouts untouched without the player bar", () => {
    expect(popoutInset()).toBe("0px");
  });

  // the popovers size themselves from the props and the sheet from the tokens,
  // so a drift between the two would only show up on one of them
  it("offsets the popovers by the same gaps the sheet reads", () => {
    expect(customProperty("--player-bar-popout-gap")).toBe(
      `${PLAYER_BAR_POPOUT_GAP}px`,
    );
    expect(customProperty("--player-bar-popout-inset-x")).toBe(
      `${PLAYER_BAR_POPOUT_INSET_X}px`,
    );
    expect(customProperty("--player-bar-popout-top-gap")).toBe(
      `${PLAYER_BAR_POPOUT_COLLISION_PADDING.top}px`,
    );
  });

  // the popouts hang above the dock and reach down behind it, so anything but a
  // shared edge leaves the two surfaces stepping over one another
  it("sets the popouts in as far as the dock they hang above", () => {
    expect(customProperty("--player-bar-popout-inset-x")).toBe(
      customProperty("--mobile-dock-inset-x"),
    );
  });
});

// Every term carries its own value, so one going missing or landing on the
// wrong side reads as the wrong number instead of quietly passing.
const INSET_X = "5px";
const INSET_LEFT = "77px";
const INSET_RIGHT = "44px";

// the widths are Tailwind utilities, so the templates name them and the
// compiled sheet is what they mean; taking the class from one and reading it
// against the other covers both a term going missing and the utility itself
// stopping being emitted
function popoutWidthClasses(source: string) {
  return [
    ...source.matchAll(
      /(?:max-)?w-\[calc\([^\]]*--player-bar-popout-inset-x[^\]]*\]/g,
    ),
  ].map((match) => match[0]);
}

function resolveWidth(className: string) {
  const element = document.createElement("div");
  element.className = className;
  document.body.appendChild(element);
  const styles = getComputedStyle(element);
  const width = className.startsWith("max-") ? styles.maxWidth : styles.width;
  return width.replace(/\s+/g, "");
}

describe.each([
  ["player select", playerSelectSource],
  ["group control", groupControlSource],
  ["volume control", volumeControlSource],
])("%s popout width", (_name, source) => {
  let widthStyles: HTMLStyleElement;

  beforeEach(() => {
    widthStyles = document.createElement("style");
    widthStyles.textContent = css;
    document.head.appendChild(widthStyles);
    document.documentElement.style.setProperty(
      "--player-bar-popout-inset-x",
      INSET_X,
    );
    document.documentElement.style.setProperty(
      "--device-inset-left",
      INSET_LEFT,
    );
    document.documentElement.style.setProperty(
      "--device-inset-right",
      INSET_RIGHT,
    );
  });

  afterEach(() => {
    widthStyles.remove();
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  // The popouts hang off the safe end of the bar, so a width measured from the
  // whole screen would push their far edge back under the opposite cutout.
  it("spans the screen less both cutouts", () => {
    const classNames = popoutWidthClasses(source);

    expect(classNames.length).toBeGreaterThan(0);
    for (const className of classNames) {
      expect(resolveWidth(className)).toBe(
        `calc(${window.innerWidth}px-2*${INSET_X}-${INSET_LEFT}-${INSET_RIGHT})`,
      );
    }
  });
});
