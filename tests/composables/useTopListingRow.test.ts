import { useTopListingRow } from "@/composables/useTopListingRow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

const scopes: EffectScope[] = [];

// the row under the sample point, as the browser would report it
function rowAtTop(index: number | undefined) {
  const row = document.createElement("div");
  if (index !== undefined) row.dataset.listingIndex = String(index);
  document.elementFromPoint = vi.fn(() => (index === undefined ? null : row));
}

function setupTracker(enabled = ref(true)) {
  const scroller = document.createElement("div");
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
    const row = document.createElement("div");
    row.dataset.listingIndex = "0";
    document.elementFromPoint = vi
      .fn()
      .mockReturnValueOnce(document.body)
      .mockReturnValue(row);
    const { topIndex } = setupTracker();
    await frame();

    expect(topIndex.value).toBe(0);
  });

  it("forgets the row when tracking is turned off", async () => {
    rowAtTop(5);
    const enabled = ref(true);
    const { topIndex } = setupTracker(enabled);
    await frame();
    expect(topIndex.value).toBe(5);

    enabled.value = false;
    await frame();

    expect(topIndex.value).toBeUndefined();
  });
});
