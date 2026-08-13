import { deviceInset } from "@/helpers/device";

/**
 * Gap the popouts keep from the bar below them and from the sides of the
 * screen. Mirrors --player-bar-popout-gap.
 */
export const PLAYER_BAR_POPOUT_GAP = 8;

/**
 * Room a tall popout leaves at the top of the screen, so it keeps reading as a
 * card floating above the player bar instead of a full-height panel. Mirrors
 * --player-bar-popout-top-gap.
 */
const PLAYER_BAR_POPOUT_TOP_GAP = 24;

/** Room the popouts leave around themselves as they grow with their contents. */
export const PLAYER_BAR_POPOUT_COLLISION_PADDING = {
  top: PLAYER_BAR_POPOUT_TOP_GAP,
  // the boundary this is measured against spans the cutout, so the side gaps
  // only stay clear of it by carrying the inset. Reading them through getters
  // hands each popout the inset it opens under without handing floating-ui a
  // new object to rebuild its middleware around
  get right() {
    return PLAYER_BAR_POPOUT_GAP + deviceInset("right");
  },
  bottom: PLAYER_BAR_POPOUT_GAP,
  get left() {
    return PLAYER_BAR_POPOUT_GAP + deviceInset("left");
  },
};

export const playerBarEndAnchor = {
  getBoundingClientRect: () => {
    // hanging off the bar itself keeps the gap below the popouts independent of
    // where its buttons sit inside it; the mobile bar floats over them instead,
    // leaving the navigation the trigger sits in as the edge to hang from
    const anchorRect = (
      document.getElementById("player-bar") ??
      document.getElementById("player-select-button")
    )?.getBoundingClientRect();
    // the window reaches past the cutout, so the gap is kept from the last
    // column of pixels that is actually safe to draw in
    return new DOMRect(
      window.innerWidth - PLAYER_BAR_POPOUT_GAP - deviceInset("right"),
      anchorRect?.top ?? window.innerHeight,
      0,
      anchorRect?.height ?? 0,
    );
  },
};

// the fullscreen player covers the player bar, so popouts opened from there
// align to its own player select button instead
export const fullscreenPlayerSelectAnchor = {
  getBoundingClientRect: () => {
    const triggerRect = document
      .getElementById("fullscreen-player-select-button")
      ?.getBoundingClientRect();
    // the button is hidden on very short screens; fall back to the bottom center
    return (
      triggerRect ??
      new DOMRect(window.innerWidth / 2, window.innerHeight, 0, 0)
    );
  },
};
