import { useMusicQuizRoundStartScroll } from "@/composables/music-quiz/useMusicQuizRoundStartScroll";
import { effectScope, nextTick, ref, type Ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  setReducedMotion(false);
});

describe("useMusicQuizRoundStartScroll", () => {
  it("scrolls once when becoming active with a round index", async () => {
    const { active, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    active.value = false;

    createScroller({ active, roundIndex, target, scope });
    active.value = true;
    roundIndex.value = 0;
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
    scope.stop();
  });

  it("does not scroll again for the same round", async () => {
    const { active, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    active.value = true;
    roundIndex.value = 2;

    createScroller({ active, roundIndex, target, scope });
    await nextTick();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    active.value = false;
    await nextTick();
    active.value = true;
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("scrolls again for the next round", async () => {
    const { active, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    active.value = true;
    roundIndex.value = 0;

    createScroller({ active, roundIndex, target, scope });
    await nextTick();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    roundIndex.value = 1;
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    scope.stop();
  });

  it("does not scroll when inactive during reveal", async () => {
    const { active, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    active.value = false;
    roundIndex.value = 0;

    createScroller({ active, roundIndex, target, scope });
    await nextTick();

    expect(scrollIntoView).not.toHaveBeenCalled();
    scope.stop();
  });

  it("does not scroll when the target is null", async () => {
    const { active, roundIndex, target, scope } = createOptions();
    active.value = true;
    roundIndex.value = 0;

    createScroller({ active, roundIndex, target, scope });
    await nextTick();

    expect(scrollIntoView).not.toHaveBeenCalled();
    scope.stop();
  });

  it("skips smooth scrolling when motion is reduced", async () => {
    setReducedMotion(true);
    const { active, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    active.value = true;
    roundIndex.value = 0;

    createScroller({ active, roundIndex, target, scope });
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "auto",
    });
    scope.stop();
  });
});

function createOptions() {
  return {
    active: ref(false),
    roundIndex: ref<number | null>(null),
    target: ref<HTMLElement | null>(null) as Ref<HTMLElement | null>,
    scope: effectScope(),
  };
}

function createScroller({
  active,
  roundIndex,
  target,
  scope,
}: ReturnType<typeof createOptions>) {
  scope.run(() =>
    useMusicQuizRoundStartScroll({
      active: () => active.value,
      roundIndex: () => roundIndex.value,
      target,
    }),
  );
}

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
