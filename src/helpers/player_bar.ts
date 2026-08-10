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
