import { capturePageSnapshot } from "@/helpers/page_snapshot";
import { afterEach, describe, expect, it } from "vitest";

/**
 * A page with something scrolled inside it, as the back swipe finds it: the
 * page itself paints nothing and sits on a frame that does.
 */
function pageWithScroller() {
  const frame = document.createElement("main");
  frame.style.backgroundColor = "rgb(18, 18, 18)";
  const page = document.createElement("div");
  const scroller = document.createElement("div");
  scroller.id = "scroller";
  scroller.className = "scroller";
  scroller.textContent = "the view being left";
  page.appendChild(scroller);
  frame.appendChild(page);
  document.body.appendChild(frame);
  // jsdom does not lay anything out, so scroll offsets have to be declared
  Object.defineProperty(scroller, "scrollTop", { value: 640, writable: true });
  return page;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("capturePageSnapshot", () => {
  it("pins a copy of the page over the top of it", () => {
    const snapshot = capturePageSnapshot(pageWithScroller());

    expect(snapshot.el.parentElement).toBe(document.body);
    expect(snapshot.el.textContent).toContain("the view being left");
    expect(snapshot.el.style.position).toBe("fixed");
    // it is a picture: nothing should be able to read it or touch it
    expect(snapshot.el.getAttribute("aria-hidden")).toBe("true");
    expect(snapshot.el.hasAttribute("inert")).toBe(true);
    expect(snapshot.el.style.pointerEvents).toBe("none");
  });

  // the page draws no background of its own, so a bare clone lets the view
  // underneath show straight through and the two read as a single jumbled page
  it("carries the background the page was sitting on", () => {
    const snapshot = capturePageSnapshot(pageWithScroller());

    expect(snapshot.el.style.backgroundColor).toBe("rgb(18, 18, 18)");
  });

  it("falls back to the theme background when nothing paints one", () => {
    const bare = document.createElement("div");
    document.body.appendChild(bare);

    expect(capturePageSnapshot(bare).el.style.backgroundColor).toBe(
      "var(--background)",
    );
  });

  // a clone starts at the top of every scroller it holds, which would show the
  // page jumping to the top the moment the swipe freezes it
  it("keeps the page where it was scrolled to", () => {
    const snapshot = capturePageSnapshot(pageWithScroller());

    const clonedScroller = snapshot.el.querySelector<HTMLElement>(".scroller");
    expect(clonedScroller?.scrollTop).toBe(640);
  });

  it("strips the ids it would otherwise duplicate", () => {
    const snapshot = capturePageSnapshot(pageWithScroller());

    expect(snapshot.el.hasAttribute("id")).toBe(false);
    expect(snapshot.el.querySelectorAll("[id]")).toHaveLength(0);
    expect(snapshot.el.querySelector(".scroller")).not.toBeNull();
  });

  it("moves, animates and cleans up after itself", () => {
    const snapshot = capturePageSnapshot(pageWithScroller());

    snapshot.place(120);
    expect(snapshot.el.style.transform).toBe("translate3d(120px, 0, 0)");
    expect(snapshot.el.style.transition).toBe("none");

    snapshot.place(375, 220);
    expect(snapshot.el.style.transform).toBe("translate3d(375px, 0, 0)");
    expect(snapshot.el.style.transition).toContain("220ms");

    snapshot.remove();
    expect(snapshot.el.parentElement).toBeNull();
  });
});
