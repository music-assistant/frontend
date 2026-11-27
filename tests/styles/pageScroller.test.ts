// @vitest-environment happy-dom
import viewSource from "@/layouts/default/View.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { styleBlocks } from "./cascade";

let styles: HTMLStyleElement;

function scroller(modifier: string) {
  const element = document.createElement("div");
  element.className = `content-section ${modifier}`.trim();
  document.body.appendChild(element);
  return getComputedStyle(element);
}

describe("page scroller", () => {
  beforeEach(() => {
    styles = document.createElement("style");
    styles.textContent = styleBlocks(viewSource).join("\n");
    document.head.appendChild(styles);
  });

  afterEach(() => {
    styles.remove();
    document.body.innerHTML = "";
  });

  it.each(["", "content-section--mobile", "content-section--frameless"])(
    "contains the absolutely positioned content it scrolls ('%s')",
    (modifier) => {
      // an absolutely positioned element otherwise resolves against the
      // sidebar's <main>, which then gains a scroll range of its own
      const style = scroller(modifier);

      expect(style.overflowY).toBe("auto");
      expect(style.position).toBe("relative");
    },
  );
});
