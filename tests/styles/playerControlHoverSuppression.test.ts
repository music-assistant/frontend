// happy-dom has no hover state to simulate, so the rule is asserted with its
// :hover dropped; which of the competing backgrounds actually wins is only
// observable in a real browser
// @vitest-environment happy-dom
import css from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let styles: HTMLStyleElement;

beforeEach(() => {
  styles = document.createElement("style");
  styles.textContent = css;
  document.head.append(styles);
});

afterEach(() => {
  styles.remove();
});

// the one rule clearing a background off a button whose pointer state is stale
function suppressionSelector() {
  return [...(styles.sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => rule.style.getPropertyValue("background-color") !== "")
    .map((rule) => rule.selectorText)
    .find((selector) => selector.includes("data-suppress-hover"));
}

function trigger(attributes: Record<string, string>) {
  const button = document.createElement("button");
  button.className = "player-control-button";
  button.setAttribute("data-suppress-hover", "true");
  for (const [name, value] of Object.entries(attributes)) {
    button.setAttribute(name, value);
  }
  return button;
}

describe("player control hover suppression", () => {
  it("clears the hover background only while the popout is closed", () => {
    const selector = suppressionSelector();
    expect(selector).toBeDefined();
    const closed = selector!.replace(":hover", "");

    // reka writes data-state="closed" and Vue renders a false data-active as
    // "false", so both are present and only the value tells them apart: an
    // exclusion on the bare attribute would switch the rule off for every
    // trigger it is meant to cover
    expect(trigger({ "data-state": "closed" }).matches(closed)).toBe(true);
    expect(trigger({ "data-active": "false" }).matches(closed)).toBe(true);

    expect(trigger({ "data-state": "open" }).matches(closed)).toBe(false);
    expect(trigger({ "data-active": "true" }).matches(closed)).toBe(false);
  });
});
