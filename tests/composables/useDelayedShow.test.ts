import { useDelayedShow } from "@/composables/useDelayedShow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";

const DELAY_MS = 150;

describe("useDelayedShow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows only after the source has been on for the delay", async () => {
    const source = ref(false);
    const shown = effectScope().run(() => useDelayedShow(source, DELAY_MS))!;

    source.value = true;
    await nextTick();
    vi.advanceTimersByTime(DELAY_MS - 1);
    expect(shown.value).toBe(false);

    vi.advanceTimersByTime(1);
    expect(shown.value).toBe(true);
  });

  it("never shows a blip shorter than the delay", async () => {
    const source = ref(false);
    const shown = effectScope().run(() => useDelayedShow(source, DELAY_MS))!;

    source.value = true;
    await nextTick();
    vi.advanceTimersByTime(DELAY_MS / 2);
    source.value = false;
    await nextTick();
    vi.advanceTimersByTime(DELAY_MS);

    expect(shown.value).toBe(false);
  });

  it("hides straight away when the source turns off", async () => {
    const source = ref(true);
    const shown = effectScope().run(() => useDelayedShow(source, DELAY_MS))!;
    vi.advanceTimersByTime(DELAY_MS);
    expect(shown.value).toBe(true);

    source.value = false;
    await nextTick();

    expect(shown.value).toBe(false);
  });
});
