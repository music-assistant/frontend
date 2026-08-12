// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import navigationSource from "@/components/navigation/BottomNavigation.vue?raw";
import css from "@/styles/global.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERLAY_HEIGHT = "--player-bar-overlay-height";
const BAR_HEIGHT = "120px";
const NAVIGATION_INSET =
  "max( 12px, calc(env(safe-area-inset-bottom, 0px) * 0.65) )";
const NAVIGATION_HEIGHT = `calc( 72px + ${NAVIGATION_INSET} )`;
const DOCK_RIM = "4px";
const SCRIM_FADE = "16px";

let appStyles: HTMLStyleElement;

// happy-dom substitutes every var() but does not evaluate calc(), so the height
// is only observable as the expression it composes
function customProperty(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .replace(/\s+/g, " ")
    .trim();
}

function scrimHeight() {
  return customProperty("--mobile-player-scrim-height");
}

// happy-dom drops a calc() holding a var() from anything but a custom property,
// so the navigation's own offset is only observable in its source
function dockSurfaceTop() {
  const rule = navigationSource.match(
    /\.mobile-bottom-navigation::before\s*\{([^}]*)\}/,
  )?.[1];
  return rule
    ?.match(/top:([^;]*);/)?.[1]
    .replace(/\s+/g, " ")
    .trim();
}

describe("player scrim height", () => {
  beforeEach(() => {
    appStyles = document.createElement("style");
    appStyles.textContent = css;
    document.head.appendChild(appStyles);
  });

  afterEach(() => {
    appStyles.remove();
    document.documentElement.style.removeProperty(OVERLAY_HEIGHT);
  });

  it("reaches past the dock so the fade finishes clear of it", () => {
    document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);

    // the blur fades out towards its own top. Sized from anything other than the
    // dock it stops short of it once the card grows, leaving the see-through
    // dock on unblurred content with the fade ending across it.
    expect(scrimHeight()).toBe(
      `calc( ${NAVIGATION_HEIGHT} + ${BAR_HEIGHT} + ${DOCK_RIM} + ${SCRIM_FADE} )`,
    );
  });

  it("keeps that clearance before the card has been measured", () => {
    // the footer publishes the card's height once it is on screen. Until it
    // does, the blur takes the same unmeasured card the dock does, so the two
    // still line up.
    expect(scrimHeight()).toBe(
      `calc( ${NAVIGATION_HEIGHT} + 0px + ${DOCK_RIM} + ${SCRIM_FADE} )`,
    );
  });

  it("clears the same dock top the navigation lifts its surface to", () => {
    // the blur clears the dock only while both measure it the same way. The rim
    // is shared, but the composition is not, so this is what catches the two
    // drifting apart again.
    expect(
      dockSurfaceTop(),
      "the navigation's ::before must lift its surface by the card plus the rim",
    ).toBe(
      `calc( -1 * (var(${OVERLAY_HEIGHT}, 0px) + var(--mobile-dock-rim)) )`,
    );
  });
});
