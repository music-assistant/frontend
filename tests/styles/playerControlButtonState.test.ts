// happy-dom has no hover state to simulate, so the rules are asserted with their
// :hover dropped; which of the competing backgrounds actually wins is only
// observable in a real browser
// @vitest-environment happy-dom
import playerSource from "@/layouts/default/PlayerOSD/Player.vue?raw";
import css from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SCOPE_COMPOUND, rank, selectorsSetting, styleBlocks } from "./cascade";

let styles: HTMLStyleElement;

// the compiler rewrites `.a :deep(.b)` as `.a[data-v-hash] .b`, so unwrapping
// the marker leaves a selector that matches; the compound it drops is what
// SCOPE_COMPOUND credits back when the ranks compare
function barStyles() {
  const element = document.createElement("style");
  element.textContent = styleBlocks(playerSource)
    .join("\n")
    .replaceAll(/:deep\(([^)]*)\)/g, "$1");
  document.head.appendChild(element);
  return element;
}

// a player bar action as its components render it
function action(attributes: Record<string, string>) {
  const bar = document.createElement("div");
  bar.className = "mediacontrols";
  bar.innerHTML = `
    <button class="player-control-button player-bar-action">
      <span class="player-bar-action-label"></span>
    </button>`;
  const button = bar.querySelector("button")!;
  for (const [name, value] of Object.entries(attributes)) {
    button.setAttribute(name, value);
  }
  document.body.appendChild(bar);
  return button;
}

// the one rule clearing a background off a player control button
function pillSelector() {
  return [...(styles.sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => rule.style.getPropertyValue("background-color") !== "")
    .map((rule) => rule.selectorText)
    .find((selector) => selector.includes("player-control-button"));
}

describe("player control button state", () => {
  beforeEach(() => {
    styles = document.createElement("style");
    styles.textContent = css;
    document.head.append(styles);
  });

  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("clears the hover background whatever the popout is doing", () => {
    const selector = pillSelector();
    expect(selector).toBeDefined();
    const hovered = selector!.replace(":hover", "");

    // reka writes data-state="closed" and Vue renders a false data-active as
    // "false", so a resting trigger carries both attributes rather than neither
    expect(
      action({ "data-state": "closed", "data-active": "false" }),
    ).toSatisfy((button: Element) => button.matches(hovered));
    expect(action({ "data-state": "open", "data-active": "true" })).toSatisfy(
      (button: Element) => button.matches(hovered),
    );
    expect(action({ "data-suppress-hover": "true" })).toSatisfy(
      (button: Element) => button.matches(hovered),
    );
  });

  // the button reads as active by colour and weight alone, so a label left at
  // its resting weight is the whole signal missing on the showing popout
  it("weights the label of a button whose popout is showing", () => {
    const label = action({
      "data-state": "open",
      "data-active": "true",
    }).firstElementChild!;
    const resting = selectorsSetting(barStyles(), label, "font-weight");
    const declaring = selectorsSetting(styles, label, "font-weight");

    expect(declaring.length).toBeGreaterThan(0);
    expect(resting.length).toBeGreaterThan(0);
    for (const heavier of declaring) {
      for (const selector of resting) {
        expect(
          rank(heavier),
          `${selector} sets the label's resting weight, so the active weight has to out-rank it once scoped`,
        ).toBeGreaterThan(rank(selector) + SCOPE_COMPOUND);
      }
    }
  });
});
