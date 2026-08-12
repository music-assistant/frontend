// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import css from "@/styles/global.css?inline";
import partySource from "@/views/PartyDashboardView.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERLAY_HEIGHT = "--player-bar-overlay-height";
const OVERLAY_MARKER = "data-player-bar-overlay";
const BAR_HEIGHT = "120px";
const PLAYER_BAR_HEIGHT = "calc( 104px + env(safe-area-inset-bottom, 0px) )";
const NAVIGATION_INSET =
  "max( 12px, calc(env(safe-area-inset-bottom, 0px) * 0.65) )";
const NAVIGATION_HEIGHT = `calc( 72px + ${NAVIGATION_INSET} )`;
// distinct from the rim's own 4px, so the assertion cannot pass on a rule that
// hardcodes the number instead of reading the property
const DOCK_RIM = "7px";
const GAP = "4px";

// the view's own rules live in its unscoped block, the only one it can reach
// the container it is mounted in from
const partyStyles = partySource.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";

let appStyles: HTMLStyleElement;
let viewStyles: HTMLStyleElement;

// happy-dom substitutes every var() but does not evaluate calc(), so the offset
// is only observable as the expression it composes
function playerBottom(...classes: string[]) {
  const section = document.createElement("div");
  section.className = ["content-section", ...classes, "party-view-active"].join(
    " ",
  );
  document.body.appendChild(section);
  return getComputedStyle(section)
    .getPropertyValue("--party-player-bottom")
    .replace(/\s+/g, " ")
    .trim();
}

describe("party dashboard bottom offset", () => {
  beforeEach(() => {
    appStyles = document.createElement("style");
    appStyles.textContent = css;
    document.head.appendChild(appStyles);
    viewStyles = document.createElement("style");
    viewStyles.textContent = partyStyles;
    document.head.appendChild(viewStyles);
  });

  afterEach(() => {
    appStyles.remove();
    viewStyles.remove();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute(OVERLAY_MARKER);
    document.documentElement.style.removeProperty(OVERLAY_HEIGHT);
  });

  it("clears the player bar in the desktop layout", () => {
    expect(playerBottom()).toBe(`calc(${PLAYER_BAR_HEIGHT} + ${GAP})`);
  });

  it("clears the dock the player card sits on, on mobile", () => {
    document.documentElement.setAttribute(OVERLAY_MARKER, "");
    document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);
    document.documentElement.style.setProperty("--mobile-dock-rim", DOCK_RIM);

    // the card is measured at runtime and the dock rises with it, so the offset
    // has to carry that measured height and the rim above it rather than a
    // height of its own
    expect(playerBottom("content-section--mobile")).toBe(
      `calc( calc( ${NAVIGATION_HEIGHT} + ${BAR_HEIGHT} ) + ${DOCK_RIM} + ${GAP} )`,
    );
  });

  it("sits at the screen edge in frameless mode, which has no bars at all", () => {
    document.documentElement.setAttribute(OVERLAY_MARKER, "");
    document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);

    // frameless can be mobile too, and the two rules weigh the same, so only
    // the order between them keeps the bars out of a layout without any
    expect(
      playerBottom("content-section--mobile", "content-section--frameless"),
    ).toBe(GAP);
  });
});
