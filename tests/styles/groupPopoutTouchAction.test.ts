// happy-dom cannot settle a tie between two equally specific rules, so the
// ranking is what proves the override applies whichever block loads last
// @vitest-environment happy-dom
import volumeSource from "@/layouts/default/PlayerOSD/PlayerVolume.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SCOPE_COMPOUND, rank, selectorsSetting, styleBlocks } from "./cascade";

let styles: HTMLStyleElement;

// a child row as the popout renders it
function row() {
  const popout = document.createElement("div");
  popout.className = "group-popout";
  popout.innerHTML = `
    <div class="group-popout-row">
      <div class="player-volume-wrapper">
        <div class="player-volume-container"></div>
      </div>
    </div>`;
  document.body.appendChild(popout);
  return popout.querySelector(".player-volume-container")!;
}

describe("group volume popout touch-action", () => {
  beforeEach(() => {
    styles = document.createElement("style");
    styles.textContent = styleBlocks(volumeSource).join("\n");
    document.head.appendChild(styles);
  });

  afterEach(() => {
    styles.remove();
    document.body.innerHTML = "";
  });

  it("lets a touch drag on a row pan the popout", () => {
    // touch-action is intersected from the touched element up to the scroll
    // container, so a row keeping pan-x would leave the popout unscrollable
    expect(getComputedStyle(row()).touchAction).toBe("pan-y");
  });

  it("keeps the rows panning independently of the stylesheet load order", () => {
    const declaring = selectorsSetting(styles, row(), "touch-action");
    const winner =
      ".group-popout .player-volume-wrapper .player-volume-container";

    expect(declaring).toContain(winner);
    for (const selector of declaring) {
      if (selector === winner) continue;

      expect(
        rank(winner),
        `${selector} also sets touch-action on a row, so the override has to out-rank it once scoped`,
      ).toBeGreaterThan(rank(selector) + SCOPE_COMPOUND);
    }
  });
});
