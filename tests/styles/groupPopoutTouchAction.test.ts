// happy-dom cannot settle a tie between two equally specific rules, so the
// ranking is what proves the override applies whichever block loads last
// @vitest-environment happy-dom
import volumeSource from "@/layouts/default/PlayerOSD/PlayerVolume.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// vitest only compiles the stylesheets under src/styles, so the component's own
// rules are lifted straight out of its source, in the order it declares them
function styleBlocks(source: string) {
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  );
}

// the scoped block's selectors each gain a [data-v-hash] compound at compile
// time, which the raw source does not carry
const SCOPE_COMPOUND = 1;

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

function rulesFor(element: Element) {
  return [...(styles.sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => element.matches(rule.selectorText));
}

// neither side carries an id or an element name, so counting their class-level
// compounds is the whole comparison
function rank(selector: string) {
  return (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length;
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
    const declaring = rulesFor(row()).filter(
      (rule) => rule.style.getPropertyValue("touch-action") !== "",
    );
    const winner =
      ".group-popout .player-volume-wrapper .player-volume-container";

    expect(declaring.map((rule) => rule.selectorText)).toContain(winner);
    for (const rule of declaring) {
      if (rule.selectorText === winner) continue;

      expect(
        rank(winner),
        `${rule.selectorText} also sets touch-action on a row, so the override has to out-rank it once scoped`,
      ).toBeGreaterThan(rank(rule.selectorText) + SCOPE_COMPOUND);
    }
  });
});
