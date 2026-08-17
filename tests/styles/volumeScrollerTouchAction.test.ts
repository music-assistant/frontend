// happy-dom cannot settle a tie between two equally specific rules, so the
// ranking is what proves the override applies whichever block loads last
// @vitest-environment happy-dom
import volumeSource from "@/layouts/default/PlayerOSD/PlayerVolume.vue?raw";
import panelSource from "@/layouts/default/PlayerOSD/PlayerVolumePanel.vue?raw";
import selectSource from "@/layouts/default/PlayerSelect.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SCOPE_COMPOUND, rank, selectorsSetting, styleBlocks } from "./cascade";

// the lists outside PlayerVolume that opt their rows into the vertical pan
const SCROLLERS = [
  ["the grouped volume panel", panelSource],
  ["the player list", selectSource],
] as const;

const OVERRIDE =
  ".player-volume-scroller .player-volume-wrapper .player-volume-container";

let styles: HTMLStyleElement;

// the classes the list is rendered with, read off the template so the probe
// cannot drift from the markup it stands in for
function listClasses(source: string) {
  return source.match(
    /<div[^>]*\sclass="([^"]*\bplayer-volume-scroller\b[^"]*)"/,
  )?.[1];
}

// a volume row as the lists render it
function row(classes: string) {
  const list = document.createElement("div");
  list.className = classes;
  list.innerHTML = `
    <div class="player-volume-wrapper">
      <div class="player-volume-container"></div>
    </div>`;
  document.body.appendChild(list);
  return list.querySelector(".player-volume-container")!;
}

// the list has to still be the element that scrolls, or the rows would be
// giving up their horizontal drag for a pan that never happens
function scroller(source: string) {
  const classes = listClasses(source);

  expect(classes, "the list has to keep opting in").toBeDefined();
  expect(classes, "the override only pays off on a scrolling list").toContain(
    "overflow-y-auto",
  );
  return classes!;
}

describe("volume rows in a scrolling list", () => {
  beforeEach(() => {
    styles = document.createElement("style");
    styles.textContent = styleBlocks(volumeSource).join("\n");
    document.head.appendChild(styles);
  });

  afterEach(() => {
    styles.remove();
    document.body.innerHTML = "";
  });

  it.each(SCROLLERS)("lets a touch drag on a row pan %s", (_name, source) => {
    // touch-action is intersected from the touched element up to the scroll
    // container, so a row keeping pan-x would leave the list unscrollable
    expect(getComputedStyle(row(scroller(source))).touchAction).toBe("pan-y");
  });

  it.each(SCROLLERS)(
    "keeps %s panning independently of the stylesheet load order",
    (_name, source) => {
      const declaring = selectorsSetting(
        styles,
        row(scroller(source)),
        "touch-action",
      );

      expect(declaring).toContain(OVERRIDE);
      for (const selector of declaring) {
        if (selector === OVERRIDE) continue;

        expect(
          rank(OVERRIDE),
          `${selector} also sets touch-action on a row, so the override has to out-rank it once scoped`,
        ).toBeGreaterThan(rank(selector) + SCOPE_COMPOUND);
      }
    },
  );
});
