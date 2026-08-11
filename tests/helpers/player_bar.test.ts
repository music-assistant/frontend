import { fullscreenPlayerSelectAnchor } from "@/helpers/player_bar";
import { afterEach, describe, expect, it } from "vitest";

const BUTTON_ID = "fullscreen-player-select-button";

function addTrigger(rect: Partial<DOMRect>) {
  const trigger = document.createElement("button");
  trigger.id = BUTTON_ID;
  trigger.getBoundingClientRect = () => rect as DOMRect;
  document.body.appendChild(trigger);
  return trigger;
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
