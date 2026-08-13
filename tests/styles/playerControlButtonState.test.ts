// happy-dom has no hover state to simulate and cannot settle a tie between two
// equally specific rules, so which of the competing backgrounds wins is weighed
// by ranking their selectors instead of read back off a hovered button
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

// the rule clearing the pill off a player control button and the ghost variant's
// dark hover fill it has to beat, in the order the sheet declares them. Tailwind
// gates its hover: utilities behind @media (hover: hover), so the fill only
// comes into view once the media rules are flattened out
function pillRules() {
  const painting = [...(styles.sheet?.cssRules ?? [])]
    .flatMap((rule) =>
      rule instanceof CSSMediaRule ? [...rule.cssRules] : [rule],
    )
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => rule.style.getPropertyValue("background-color") !== "");
  return {
    painting,
    cleared: painting.find((rule) =>
      rule.selectorText.includes("player-control-button"),
    ),
    fill: painting.find(
      (rule) =>
        rule.selectorText.includes("bg-accent") &&
        rule.selectorText.includes("dark"),
    ),
  };
}

// rank() counts compounds off a hand-written selector, and a compiled utility is
// neither: the variant separators live escaped inside the class name, where the
// backslashed colons read as pseudo-classes, and the dark variant arrives as an
// :is() whose own compound is the only one that counts
function plainSelector(selector: string) {
  return selector.replaceAll(/\\./g, "").replaceAll(/:is\(([^)]*)\)/g, "$1");
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
    const { cleared } = pillRules();
    expect(cleared).toBeDefined();
    expect(cleared!.style.getPropertyValue("background-color")).toBe(
      "transparent",
    );
    const hovered = cleared!.selectorText.replace(":hover", "");

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

  // the utilities are imported !important and unlayered, so importance settles
  // nothing here: the fill is beaten on rank, or on order at an equal rank
  it("out-ranks the fill it clears", () => {
    const { painting, cleared, fill } = pillRules();
    expect(fill).toBeDefined();
    expect(fill!.style.getPropertyPriority("background-color")).toBe(
      "important",
    );

    expect(rank(plainSelector(cleared!.selectorText))).toBeGreaterThanOrEqual(
      rank(plainSelector(fill!.selectorText)),
    );
    expect(painting.indexOf(cleared!)).toBeGreaterThan(painting.indexOf(fill!));
  });

  // the colour is the other half of the signal, so a label left at its resting
  // weight reads as half-lit next to the mobile navigation it mirrors
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
