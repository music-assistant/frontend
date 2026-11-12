import { useTopListingRow } from "@/composables/useTopListingRow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

const scopes: EffectScope[] = [];

const scroller = document.createElement("div");

// the row under the sample point, as the browser would report it
function rowAtTop(index: number | undefined) {
  const row = document.createElement("div");
  if (index !== undefined) row.dataset.listingIndex = String(index);
  scroller.appendChild(row);
  document.elementFromPoint = vi.fn(() => (index === undefined ? null : row));
}

function setupTracker(enabled = ref(true)) {
  document.body.appendChild(scroller);
  const scope = effectScope();
  scopes.push(scope);
  const tracker = scope.run(() =>
    useTopListingRow(() => scroller, scroller, enabled),
  )!;
  return { scroller, enabled, ...tracker };
}

const frame = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useTopListingRow", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) =>
      setTimeout(() => fn(0), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  });

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    scroller.innerHTML = "";
  });

  it("reports the row at the top once the list scrolls", async () => {
    rowAtTop(7);
    const { scroller, topIndex } = setupTracker();
    await frame();

    rowAtTop(12);
    scroller.dispatchEvent(new Event("scroll"));
    await frame();

    expect(topIndex.value).toBe(12);
  });

  it("measures once per frame however many scroll events arrive", async () => {
    rowAtTop(3);
    const { scroller } = setupTracker();
    await frame();
    const probe = document.elementFromPoint as ReturnType<typeof vi.fn>;
    probe.mockClear();

    scroller.dispatchEvent(new Event("scroll"));
    scroller.dispatchEvent(new Event("scroll"));
    scroller.dispatchEvent(new Event("scroll"));
    await frame();

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("looks further down when the first point falls between rows", async () => {
    const gap = document.createElement("div");
    const row = document.createElement("div");
    row.dataset.listingIndex = "0";
    scroller.append(gap, row);
    document.elementFromPoint = vi
      .fn()
      .mockReturnValueOnce(gap)
      .mockReturnValue(row);
    const { topIndex } = setupTracker();
    await frame();

    expect(topIndex.value).toBe(0);
  });

  it("looks past a header above the list to the first row", async () => {
    const header = document.createElement("div");
    document.body.appendChild(header);
    const row = document.createElement("div");
    row.dataset.listingIndex = "0";
    scroller.appendChild(row);
    document.elementFromPoint = vi
      .fn()
      .mockReturnValueOnce(header)
      .mockReturnValue(row);
    const { topIndex } = setupTracker();
    await frame();

    expect(topIndex.value).toBe(0);
  });

  it("keeps the last row while something covers the list", async () => {
    rowAtTop(4);
    const { scroller, topIndex } = setupTracker();
    await frame();
    const backdrop = document.createElement("div");
    document.body.appendChild(backdrop);
    document.elementFromPoint = vi.fn(() => backdrop);

    scroller.dispatchEvent(new Event("scroll"));
    await frame();
    expect(topIndex.value).toBe(4);

    // once uncovered, the list is looked at again without a scroll
    rowAtTop(9);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(topIndex.value).toBe(9);
  });

  it("forgets the row and stops measuring when tracking is turned off", async () => {
    rowAtTop(5);
    const enabled = ref(true);
    const { scroller, topIndex } = setupTracker(enabled);
    await frame();
    expect(topIndex.value).toBe(5);

    enabled.value = false;
    await frame();
    rowAtTop(8);
    scroller.dispatchEvent(new Event("scroll"));
    await frame();

    expect(topIndex.value).toBeUndefined();
    expect(document.elementFromPoint).not.toHaveBeenCalled();
  });
});
