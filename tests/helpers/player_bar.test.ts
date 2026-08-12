import {
  PLAYER_BAR_POPOUT_GAP,
  fullscreenPlayerSelectAnchor,
  playerBarEndAnchor,
} from "@/helpers/player_bar";
import { afterEach, describe, expect, it } from "vitest";

const BUTTON_ID = "fullscreen-player-select-button";
const PLAYER_BAR_ID = "player-bar";
const PLAYER_SELECT_BUTTON_ID = "player-select-button";

function addTrigger(rect: Partial<DOMRect>) {
  const trigger = document.createElement("button");
  trigger.id = BUTTON_ID;
  trigger.getBoundingClientRect = () => rect as DOMRect;
  document.body.appendChild(trigger);
  return trigger;
}

function addElement(id: string, rect: Partial<DOMRect>) {
  const element = document.createElement("div");
  element.id = id;
  element.getBoundingClientRect = () => rect as DOMRect;
  document.body.appendChild(element);
  return element;
}

describe("fullscreenPlayerSelectAnchor", () => {
  afterEach(() => {
    document.getElementById(BUTTON_ID)?.remove();
  });

  it("anchors to the player select button of the fullscreen player", () => {
    addTrigger({ top: 700, left: 120, width: 150, height: 26 });

    expect(fullscreenPlayerSelectAnchor.getBoundingClientRect()).toMatchObject({
      top: 700,
      left: 120,
      width: 150,
      height: 26,
    });
  });

  it("falls back to the bottom of the screen without that button", () => {
    const rect = fullscreenPlayerSelectAnchor.getBoundingClientRect();

    expect(rect.x).toBe(window.innerWidth / 2);
    expect(rect.y).toBe(window.innerHeight);
    expect(rect.height).toBe(0);
  });
});

describe("playerBarEndAnchor", () => {
  afterEach(() => {
    document.getElementById(PLAYER_BAR_ID)?.remove();
    document.getElementById(PLAYER_SELECT_BUTTON_ID)?.remove();
  });

  it("hangs the popouts above the player bar rather than above its buttons", () => {
    addElement(PLAYER_BAR_ID, { top: 616, height: 104 });
    addElement(PLAYER_SELECT_BUTTON_ID, { top: 628, height: 80 });

    const rect = playerBarEndAnchor.getBoundingClientRect();

    expect(rect.y).toBe(616);
    expect(rect.height).toBe(104);
  });

  it("hangs them above the navigation the trigger sits in without a player bar", () => {
    addElement(PLAYER_SELECT_BUTTON_ID, { top: 827, height: 64 });

    const rect = playerBarEndAnchor.getBoundingClientRect();

    expect(rect.y).toBe(827);
    expect(rect.height).toBe(64);
  });

  it("falls back to the bottom of the screen without either", () => {
    const rect = playerBarEndAnchor.getBoundingClientRect();

    expect(rect.y).toBe(window.innerHeight);
    expect(rect.height).toBe(0);
  });

  it("keeps the popout gap from the end of the screen", () => {
    expect(playerBarEndAnchor.getBoundingClientRect().x).toBe(
      window.innerWidth - PLAYER_BAR_POPOUT_GAP,
    );
  });
});
