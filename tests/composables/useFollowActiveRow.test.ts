import { useFollowActiveRow } from "@/composables/useFollowActiveRow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";

const ROW_HEIGHT = 30;

// a box of five rows, the fourth one playing
const mountBox = () => {
  const box = document.createElement("div");
  for (let i = 0; i < 5; i++) {
    const row = document.createElement("button");
    if (i === 3) row.setAttribute("aria-current", "true");
    row.getBoundingClientRect = () => new DOMRect(0, i * ROW_HEIGHT, 100, 30);
    box.append(row);
  }
  box.scrollTo = vi.fn() as typeof box.scrollTo;
  document.body.append(box);
  return box;
};

describe("useFollowActiveRow", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("scrolls to the playing row and back to it after the user stops browsing", async () => {
    const box = mountBox();
    const active = ref(3);
    const scope = effectScope();
    scope.run(() => useFollowActiveRow(ref(box), active, 1));
    await nextTick();
    // one row peeks above the playing one
    expect(box.scrollTo).toHaveBeenLastCalledWith({
      top: 2 * ROW_HEIGHT,
      behavior: "auto",
    });

    box.dispatchEvent(new Event("wheel"));
    vi.mocked(box.scrollTo).mockClear();
    active.value = 4;
    await nextTick();
    expect(box.scrollTo).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(box.scrollTo).toHaveBeenCalledWith({
      top: 2 * ROW_HEIGHT,
      behavior: "smooth",
    });
    scope.stop();
  });
});
