// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import css from "@/styles/global.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERLAY_HEIGHT = "--player-bar-overlay-height";
const OVERLAY_MARKER = "data-player-bar-overlay";
const BAR_HEIGHT = "120px";
const PLAYER_BAR_HEIGHT = "calc( 104px + env(safe-area-inset-bottom, 0px) )";
const NAVIGATION_INSET =
  "max( 6px, calc(env(safe-area-inset-bottom, 0px) * 0.65) )";
const NAVIGATION_HEIGHT = `calc( 64px + ${NAVIGATION_INSET} )`;
const SCRIM_HEIGHT = `calc( 180px + ${NAVIGATION_INSET} )`;

let appStyles: HTMLStyleElement;

// happy-dom substitutes every var() but does not evaluate calc(), so the mobile
// branch is only observable as the expression it composes
function bottomBarsHeight() {
  return customProperty("--bottom-bars-height");
}

function bottomObscuredHeight() {
  return customProperty("--bottom-obscured-height");
}

function customProperty(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
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
    document.documentElement.style.removeProperty("--device-inset-bottom");
  });

  it("reserves the player bar in the desktop layout", () => {
    expect(bottomBarsHeight()).toBe(PLAYER_BAR_HEIGHT);
    // always-rendered elements offset from this, so it has to reach them
    document.documentElement.style.setProperty("--device-inset-bottom", "0px");
    expect(offsetFromBars().replace(/\s+/g, " ").trim()).toBe(
      "calc( 104px + 0px )",
    );
  });

  it("stacks the floating player bar onto the navigation on mobile", () => {
    document.documentElement.setAttribute(OVERLAY_MARKER, "");
    document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);

    expect(bottomBarsHeight()).toBe(
      `calc( ${NAVIGATION_HEIGHT} + 4px + ${BAR_HEIGHT} )`,
    );
  });

  it("reaches no further than the bars in the desktop layout", () => {
    // the scrim is mobile-only, so pulling it in here would push everything
    // that stacks below it far above the player bar
    expect(bottomObscuredHeight()).toBe(PLAYER_BAR_HEIGHT);
  });

  it("reaches over the gradient scrim on mobile", () => {
    document.documentElement.setAttribute(OVERLAY_MARKER, "");
    document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);

    expect(bottomObscuredHeight()).toBe(
      `max( calc( ${NAVIGATION_HEIGHT} + 4px + ${BAR_HEIGHT} ), ${SCRIM_HEIGHT} )`,
    );
  });
});
