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
  right: PLAYER_BAR_POPOUT_GAP,
  bottom: PLAYER_BAR_POPOUT_GAP,
  left: PLAYER_BAR_POPOUT_GAP,
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
    return new DOMRect(
      window.innerWidth - PLAYER_BAR_POPOUT_GAP,
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
