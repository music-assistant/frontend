// @vitest-environment happy-dom
import css from "@/styles/global.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectorsSetting } from "./cascade";

let styles: HTMLStyleElement;

beforeEach(() => {
  styles = document.createElement("style");
  styles.textContent = css;
  document.head.appendChild(styles);
});

afterEach(() => {
  styles.remove();
  document.body.innerHTML = "";
});

describe("overscroll chaining", () => {
  it("keeps a drag the app does not consume inside the document", () => {
    expect(getComputedStyle(document.documentElement).overscrollBehavior).toBe(
      "none",
    );
  });

  it("cuts only the last hop, out of the document", () => {
    // The viewport takes the property from the root and nowhere else, and it
    // does not inherit - so declaring it there leaves an in-page scroller
    // chaining to the scroller around it the way it always has.
    const scroller = document.createElement("div");
    scroller.className = "scroll-container";
    document.body.appendChild(scroller);

    expect(
      selectorsSetting(styles, document.documentElement, "overscroll-behavior"),
    ).toEqual(["html"]);
    expect(selectorsSetting(styles, scroller, "overscroll-behavior")).toEqual(
      [],
    );
  });
});
