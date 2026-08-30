// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import css from "@/styles/global.css?inline";
import partySource from "@/views/PartyDashboardView.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const OVERLAY_HEIGHT = "--player-bar-overlay-height";
const OVERLAY_MARKER = "data-player-bar-overlay";
const DOCK_RIM_PROPERTY = "--mobile-dock-rim";
const DOCK_INSET_PROPERTY = "--mobile-dock-inset-x";
const BAR_HEIGHT = "120px";
const PLAYER_BAR_HEIGHT = "calc( 104px + env(safe-area-inset-bottom, 0px) )";
const NAVIGATION_INSET =
  "max( 12px, calc(env(safe-area-inset-bottom, 0px) * 0.65) )";
const NAVIGATION_HEIGHT = `calc( 72px + ${NAVIGATION_INSET} )`;
// distinct from the rim's own 4px, so the assertion cannot pass on a rule that
// hardcodes the number instead of reading the property
const DOCK_RIM = "7px";
// likewise distinct from the dock inset's own 12px
const DOCK_INSET_X = "9px";
const GAP = "4px";

// the view's own rules live in its unscoped block, the only one it can reach
// the container it is mounted in from
const partyStyles = partySource.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";

let appStyles: HTMLStyleElement;
let viewStyles: HTMLStyleElement;

// happy-dom substitutes every var() but does not evaluate calc(), so an offset
// is only observable as the expression it composes
function partyOffset(property: string, ...classes: string[]) {
  const section = document.createElement("div");
  section.className = ["content-section", ...classes, "party-view-active"].join(
    " ",
  );
  document.body.appendChild(section);
  return getComputedStyle(section)
    .getPropertyValue(property)
    .replace(/\s+/g, " ")
    .trim();
}

const playerBottom = (...classes: string[]) =>
  partyOffset("--party-player-bottom", ...classes);
const playerRight = (...classes: string[]) =>
  partyOffset("--party-player-right", ...classes);

describe("party dashboard overlay offsets", () => {
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
    document.documentElement.style.removeProperty(DOCK_RIM_PROPERTY);
    document.documentElement.style.removeProperty(DOCK_INSET_PROPERTY);
  });

  describe("bottom", () => {
    it("clears the player bar in the desktop layout", () => {
      expect(playerBottom()).toBe(`calc(${PLAYER_BAR_HEIGHT} + ${GAP})`);
    });

    it("clears the dock the player card sits on, on mobile", () => {
      document.documentElement.setAttribute(OVERLAY_MARKER, "");
      document.documentElement.style.setProperty(OVERLAY_HEIGHT, BAR_HEIGHT);
      document.documentElement.style.setProperty(DOCK_RIM_PROPERTY, DOCK_RIM);

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

  describe("right", () => {
    it("keeps its own gap from the side in the desktop layout", () => {
      // the player bar runs the full width there, so nothing sets an edge to
      // line up with
      expect(playerRight()).toBe(GAP);
    });

    it("lines up with the floating player card on mobile", () => {
      document.documentElement.style.setProperty(DOCK_RIM_PROPERTY, DOCK_RIM);
      document.documentElement.style.setProperty(
        DOCK_INSET_PROPERTY,
        DOCK_INSET_X,
      );

      // the card's inset, and only that: the layout the overlay is positioned
      // inside is already padded by the device inset the fixed bars add
      expect(playerRight("content-section--mobile")).toBe(
        `calc( ${DOCK_INSET_X} + ${DOCK_RIM} )`,
      );
    });

    it("sits at the screen edge in frameless mode, which has no dock", () => {
      document.documentElement.style.setProperty(DOCK_RIM_PROPERTY, DOCK_RIM);
      document.documentElement.style.setProperty(
        DOCK_INSET_PROPERTY,
        DOCK_INSET_X,
      );

      // same order-dependent pairing as the bottom offset, so frameless keeps
      // the dock's inset out of a layout without one
      expect(
        playerRight("content-section--mobile", "content-section--frameless"),
      ).toBe(GAP);
    });
  });
});
