// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import navigationSource from "@/components/navigation/BottomNavigation.vue?raw";
import footerSource from "@/layouts/default/Footer.vue?raw";
import css from "@/styles/global.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERLAY_HEIGHT = "--player-bar-overlay-height";
const BAR_HEIGHT = "120px";
const NAVIGATION_INSET =
  "max( 12px, calc(env(safe-area-inset-bottom, 0px) * 0.65) )";
const NAVIGATION_HEIGHT = `calc( 72px + ${NAVIGATION_INSET} )`;
const DOCK_RIM = "4px";
const SCRIM_FADE_PROPERTY = "--mobile-player-scrim-fade-height";
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
  const rule = styleRule(
    navigationSource,
    String.raw`\.mobile-bottom-navigation::before`,
  );
  return rule
    ?.match(/top:([^;]*);/)?.[1]
    .replace(/\s+/g, " ")
    .trim();
}

function styleRule(source: string, selector: string) {
  return source.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1];
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

    // The fade occupies the wrapper's top edge, so the wrapper must grow with
    // the dock to keep that edge above the player.
    expect(scrimHeight()).toBe(
      `calc( ${NAVIGATION_HEIGHT} + ${BAR_HEIGHT} + ${DOCK_RIM} + ${SCRIM_FADE} )`,
    );
  });

  it("keeps that clearance before the card has been measured", () => {
    // Until the footer publishes the card's height, the wrapper and dock both
    // use the same zero-height fallback.
    expect(scrimHeight()).toBe(
      `calc( ${NAVIGATION_HEIGHT} + 0px + ${DOCK_RIM} + ${SCRIM_FADE} )`,
    );
  });

  it("clears the same dock top the navigation lifts its surface to", () => {
    // The fade meets the dock only while both use the same card and rim height.
    expect(
      dockSurfaceTop(),
      "the navigation's ::before must lift its surface by the card plus the rim",
    ).toBe(
      `calc( -1 * (var(${OVERLAY_HEIGHT}, 0px) + var(--mobile-dock-rim)) )`,
    );
  });

  it("keeps the required dock blur separate from the masked fade", () => {
    const dockRules = [
      ...navigationSource.matchAll(
        /\.mobile-bottom-navigation::before\s*\{([^}]*)\}/g,
      ),
    ]
      .map((match) => match[1])
      .join("\n");
    const scrimRule = styleRule(footerSource, String.raw`\.player-scrim`);
    const fadeRule = styleRule(
      footerSource,
      String.raw`\.player-scrim::before`,
    );

    expect(dockRules).toMatch(/(?:^|\s)backdrop-filter:\s*blur\(14px\)/);
    expect(dockRules).toContain("-webkit-backdrop-filter: blur(14px)");
    expect(dockRules).toContain("background: var(--background)");
    expect(dockRules).not.toContain("mask-image");
    expect(scrimRule).not.toContain("backdrop-filter");
    expect(scrimRule).not.toContain("mask-image");
    expect(fadeRule).toContain(`height: var(${SCRIM_FADE_PROPERTY})`);
    expect(fadeRule).toContain("backdrop-filter: blur(14px)");
    expect(fadeRule).toContain("mask-image: linear-gradient");
  });
});
