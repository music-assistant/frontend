// @vitest-environment happy-dom
import css from "@/styles/global.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectorsSetting } from "./cascade";

let styles: HTMLStyleElement;

// Drop the comments so the prose explaining the rule cannot stand in for it.
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

beforeEach(() => {
  styles = document.createElement("style");
  styles.textContent = css;
  document.head.appendChild(styles);
});

afterEach(() => {
  styles.remove();
  document.documentElement.removeAttribute("data-embedded-layout");
});

describe("embedded touch-action", () => {
  it("refuses a pan the host would otherwise take", () => {
    document.documentElement.setAttribute("data-embedded-layout", "");

    expect(
      selectorsSetting(styles, document.documentElement, "touch-action"),
    ).toEqual([":root[data-embedded-layout]"]);
  });

  it("leaves a standalone session alone", () => {
    // there is no host to hand a drag to, and the rule is the one part of this
    // whose effect on in-page scrollers is engine-dependent
    expect(
      selectorsSetting(styles, document.documentElement, "touch-action"),
    ).toEqual([]);
  });

  it("keeps pinch-zoom where the engine knows it", () => {
    // declaration order is the fallback: an engine that does not parse
    // pinch-zoom keeps the none above it and still refuses the pan, so
    // reversing these would drop the refusal rather than the zoom
    expect(declarations).toMatch(
      /:root\[data-embedded-layout\]\s*\{[^}]*touch-action:\s*none;\s*touch-action:\s*pinch-zoom/,
    );
  });
});
