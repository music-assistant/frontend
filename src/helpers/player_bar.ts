export const DESKTOP_PLAYER_BAR_POPOUT_GAP = 16;
export const MOBILE_PLAYER_BAR_POPOUT_GAP = 8;

export const playerBarEndAnchor = {
  getBoundingClientRect: () => {
    const triggerRect = document
      .getElementById("player-select-button")
      ?.getBoundingClientRect();
    return new DOMRect(
      window.innerWidth - 8,
      triggerRect?.top ?? window.innerHeight,
      0,
      triggerRect?.height ?? 0,
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
