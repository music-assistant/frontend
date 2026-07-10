import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
import { effectScope, nextTick, ref, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("useMusicQuizAnswerDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks the server deadline and clamps the fraction", () => {
    const active = ref(true);
    const deadline = ref(Date.now() / 1000 + 30);
    const duration = ref(30);
    const { clock, scope } = createClock(active, deadline, duration);

    expect(clock.remainingSeconds.value).toBe(30);
    expect(clock.remainingLabel.value).toBe("30s");
    expect(clock.remainingFraction.value).toBe(1);

    vi.advanceTimersByTime(10_000);

    expect(clock.remainingSeconds.value).toBe(20);
    expect(clock.remainingFraction.value).toBeCloseTo(2 / 3);

    vi.advanceTimersByTime(30_000);

    expect(clock.remainingSeconds.value).toBe(0);
    expect(clock.remainingFraction.value).toBe(0);
    scope.stop();
  });

  it("formats minute labels and stops when inactive", async () => {
    const active = ref(true);
    const deadline = ref(Date.now() / 1000 + 65);
    const duration = ref(65);
    const { clock, scope } = createClock(active, deadline, duration);

    expect(clock.remainingLabel.value).toBe("1:05");

    active.value = false;
    await nextTick();

    expect(clock.remainingSeconds.value).toBeNull();
    expect(clock.remainingFraction.value).toBeNull();
    expect(clock.remainingLabel.value).toBe("");
    scope.stop();
  });

  it("uses a zero fraction for an invalid duration", () => {
    const active = ref(true);
    const deadline = ref(Date.now() / 1000 + 10);
    const duration = ref(0);
    const { clock, scope } = createClock(active, deadline, duration);

    expect(clock.remainingFraction.value).toBe(0);
    scope.stop();
  });
});

function createClock(
  active: Ref<boolean>,
  deadline: Ref<number>,
  duration: Ref<number>,
) {
  const scope = effectScope();
  const clock = scope.run(() =>
    useMusicQuizAnswerDeadline({
      active,
      deadline,
      duration,
    }),
  );
  if (!clock) throw new Error("Failed to create deadline clock");
  return { clock, scope };
}
