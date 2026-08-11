// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import css from "@/styles/global.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERLAY_HEIGHT = "--player-bar-overlay-height";
const OVERLAY_MARKER = "data-player-bar-overlay";
const BAR_HEIGHT = "120px";
const PLAYER_BAR_HEIGHT = "104px";
const NAVIGATION_HEIGHT =
  "calc(66px + calc(10px + env(safe-area-inset-bottom, 0px)))";

let appStyles: HTMLStyleElement;

// happy-dom substitutes every var() but does not evaluate calc(), so the mobile
// branch is only observable as the expression it composes
function bottomBarsHeight() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--bottom-bars-height")
    .replace(/\s+/g, " ")
    .trim();
}

// happy-dom caches an element's computed style from its first read, so this
// builds its probe after the document state it measures is in place
function offsetFromBars() {
  const probe = document.createElement("div");
  probe.style.bottom = "var(--bottom-bars-height)";
  document.body.appendChild(probe);
  return getComputedStyle(probe).bottom;
}

describe("bottom bars height", () => {
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

  it("reserves the player bar in the desktop layout", () => {
    expect(bottomBarsHeight()).toBe(PLAYER_BAR_HEIGHT);
    // always-rendered elements offset from this, so it has to reach them
    expect(offsetFromBars()).toBe(PLAYER_BAR_HEIGHT);
  });

  it("stacks the floating player bar onto the navigation on mobile", () => {
    document.documentElement.setAttribute(OVERLAY_MARKER, "");
    document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);

    expect(bottomBarsHeight()).toBe(
      `calc( ${NAVIGATION_HEIGHT} + 6px + ${BAR_HEIGHT} )`,
    );
  });
});
