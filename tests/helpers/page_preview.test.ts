import {
  capturePagePreview,
  clearPagePreviews,
  storePagePreview,
  takePagePreview,
} from "@/helpers/page_preview";
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
  scroller.textContent = "the view being returned to";
  page.appendChild(scroller);
  frame.appendChild(page);
  document.body.appendChild(frame);
  // the test DOM does not lay anything out, so scroll offsets are declared
  Object.defineProperty(scroller, "scrollTop", { value: 640, writable: true });
  return page;
}

afterEach(() => {
  document.body.innerHTML = "";
  clearPagePreviews();
});

describe("capturePagePreview", () => {
  it("clones the page inert, without attaching it yet", () => {
    const preview = capturePagePreview(pageWithScroller());

    expect(preview.el.parentElement).toBeNull();
    expect(preview.el.textContent).toContain("the view being returned to");
    // it is a picture: nothing should be able to read it or touch it
    expect(preview.el.getAttribute("aria-hidden")).toBe("true");
    expect(preview.el.hasAttribute("inert")).toBe(true);
    expect(preview.el.style.pointerEvents).toBe("none");
  });

  // the page draws no background of its own, so a bare clone would let
  // whatever sits behind it show straight through
  it("carries the background the page was sitting on", () => {
    const preview = capturePagePreview(pageWithScroller());

    expect(preview.el.style.backgroundColor).toBe("rgb(18, 18, 18)");
  });

  // an opaque three-component color has no alpha channel to misread as zero
  it("keeps a pure black background", () => {
    const page = pageWithScroller();
    page.parentElement!.style.backgroundColor = "rgb(0, 0, 0)";

    expect(capturePagePreview(page).el.style.backgroundColor).toBe(
      "rgb(0, 0, 0)",
    );
  });

  it("falls back to the theme background when nothing paints one", () => {
    const bare = document.createElement("div");
    document.body.appendChild(bare);

    expect(capturePagePreview(bare).el.style.backgroundColor).toBe(
      "var(--background)",
    );
  });

  it("mounts underneath the live page, filling its container", () => {
    const page = pageWithScroller();
    const preview = capturePagePreview(page);

    preview.mount(page.parentElement!);

    expect(preview.el.parentElement).toBe(page.parentElement);
    expect(preview.el.style.position).toBe("absolute");
    expect(preview.el.style.zIndex).toBe("0");
    // the live page sliding over the top carries the edge shadow
    expect(preview.el.style.boxShadow).toBe("none");
  });

  // a clone starts at the top of every scroller it holds, which would show
  // the page jumping to the top the moment the preview stands in for it
  it("keeps the page where it was scrolled to once mounted", () => {
    const page = pageWithScroller();
    const preview = capturePagePreview(page);

    preview.mount(page.parentElement!);

    const scroller = preview.el.querySelector<HTMLElement>(".scroller");
    expect(scroller?.scrollTop).toBe(640);
  });

  it("strips the ids it would otherwise duplicate", () => {
    const preview = capturePagePreview(pageWithScroller());

    expect(preview.el.hasAttribute("id")).toBe(false);
    expect(preview.el.querySelectorAll("[id]")).toHaveLength(0);
    expect(preview.el.querySelector(".scroller")).not.toBeNull();
  });

  it("moves, animates and cleans up after itself", () => {
    const page = pageWithScroller();
    const preview = capturePagePreview(page);
    preview.mount(page.parentElement!);

    preview.place(-120);
    expect(preview.el.style.transform).toBe("translate3d(-120px, 0, 0)");
    expect(preview.el.style.transition).toBe("none");

    preview.place(0, 220);
    expect(preview.el.style.transform).toBe("translate3d(0px, 0, 0)");
    expect(preview.el.style.transition).toContain("220ms");

    preview.remove();
    expect(preview.el.parentElement).toBeNull();
  });
});

describe("page preview cache", () => {
  it("hands a stored preview over once", () => {
    const preview = capturePagePreview(pageWithScroller());

    storePagePreview("/albums/1", preview);

    expect(takePagePreview("/albums/1")).toBe(preview);
    expect(takePagePreview("/albums/1")).toBeUndefined();
  });

  // a swipe only ever reaches for the page one step back, so anything stored
  // long ago just holds onto detached DOM
  it("evicts the longest-stored preview beyond four", () => {
    const previews = [0, 1, 2, 3, 4].map(() =>
      capturePagePreview(pageWithScroller()),
    );
    previews.forEach((preview, i) => storePagePreview(`/page/${i}`, preview));

    expect(takePagePreview("/page/0")).toBeUndefined();
    expect(takePagePreview("/page/1")).toBe(previews[1]);
    expect(takePagePreview("/page/4")).toBe(previews[4]);
  });

  it("keeps one preview per page, the freshest", () => {
    const stale = capturePagePreview(pageWithScroller());
    const fresh = capturePagePreview(pageWithScroller());

    storePagePreview("/albums/1", stale);
    storePagePreview("/albums/1", fresh);

    expect(takePagePreview("/albums/1")).toBe(fresh);
    expect(takePagePreview("/albums/1")).toBeUndefined();
  });
});
