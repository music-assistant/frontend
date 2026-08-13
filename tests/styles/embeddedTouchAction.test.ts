// @vitest-environment happy-dom
import css from "@/styles/global.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectorsSetting } from "./cascade";

const ROOT = ":root[data-embedded-layout]";
const PANEL = ":root[data-embedded-layout] [data-player-panel]";

let styles: HTMLStyleElement;

// an element as one of the panels renders it
function panel() {
  const el = document.createElement("div");
  el.setAttribute("data-player-panel", "");
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  styles = document.createElement("style");
  styles.textContent = css;
  document.head.appendChild(styles);
});

afterEach(() => {
  styles.remove();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-embedded-layout");
});

describe("embedded touch-action", () => {
  it("refuses a pan the host would otherwise take", () => {
    document.documentElement.setAttribute("data-embedded-layout", "");

    expect(
      selectorsSetting(styles, document.documentElement, "touch-action"),
    ).toEqual([ROOT]);
  });

  it("reaches the panels the root value cannot", () => {
    // Vuetify gives the fullscreen player's card overflow-y: auto, and the
    // value resets at a scroll container, so the root alone never lands inside
    document.documentElement.setAttribute("data-embedded-layout", "");

    expect(selectorsSetting(styles, panel(), "touch-action")).toEqual([PANEL]);
  });

  it("keeps pinch-zoom, which is the whole reason it is not none", () => {
    // none would take zoom away with it, and manipulation still permits the pan
    const declaring = [...(styles.sheet?.cssRules ?? [])]
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .filter((rule) => rule.style.getPropertyValue("touch-action") !== "");

    expect(declaring).toHaveLength(1);
    expect(declaring[0].style.getPropertyValue("touch-action")).toBe(
      "pinch-zoom",
    );
  });

  it("leaves a standalone session alone", () => {
    // there is no host to hand a drag to
    expect(
      selectorsSetting(styles, document.documentElement, "touch-action"),
    ).toEqual([]);
    expect(selectorsSetting(styles, panel(), "touch-action")).toEqual([]);
  });

  it("refuses nothing outside a panel", () => {
    // a rule broad enough to cover a plain element would reach the scrollers
    // too, which is the one thing this must not do
    document.documentElement.setAttribute("data-embedded-layout", "");
    const plain = document.createElement("div");
    document.body.appendChild(plain);

    expect(selectorsSetting(styles, plain, "touch-action")).toEqual([]);
  });
});
