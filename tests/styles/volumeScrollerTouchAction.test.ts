// happy-dom cannot settle a tie between two equally specific rules, so the
// ranking is what proves the override applies whichever block loads last
// @vitest-environment happy-dom
import volumeSource from "@/layouts/default/PlayerOSD/PlayerVolume.vue?raw";
import panelSource from "@/layouts/default/PlayerOSD/PlayerVolumePanel.vue?raw";
import selectSource from "@/layouts/default/PlayerSelect.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// the lists outside PlayerVolume that opt their rows into the vertical pan
const SCROLLERS = [
  ["the grouped volume panel", panelSource],
  ["the player list", selectSource],
] as const;

const OVERRIDE =
  ".player-volume-scroller .player-volume-wrapper .player-volume-container";

// the scoped block's selectors each gain a [data-v-hash] compound at compile
// time, which the raw source does not carry
const SCOPE_COMPOUND = 1;

let styles: HTMLStyleElement;

// vitest only compiles the stylesheets under src/styles, so PlayerVolume's own
// rules are lifted straight out of its source, in the order it declares them
function styleBlocks(source: string) {
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  );
}

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

// a rule may carry a selector list, of which only some parts land on the row
function selectorsSettingTouchAction(element: Element) {
  return [...(styles.sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => rule.style.getPropertyValue("touch-action") !== "")
    .flatMap((rule) => rule.selectorText.split(","))
    .map((selector) => selector.trim())
    .filter((selector) => element.matches(selector));
}

// neither side carries an id or an element name, so counting their class-level
// compounds is the whole comparison
function rank(selector: string) {
  return (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length;
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
      const declaring = selectorsSettingTouchAction(row(scroller(source)));

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
