import { useMusicQuizPhaseScroll } from "@/composables/music-quiz/useMusicQuizPhaseScroll";
import type { MusicQuizPhase } from "@/composables/music-quiz/useMusicQuiz";
import { effectScope, nextTick, ref, type Ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scrollIntoView = vi.fn();
const scrollTo = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  scrollTo.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });
  setReducedMotion(false);
});

describe("useMusicQuizPhaseScroll", () => {
  it("scrolls once when a round starts answering", async () => {
    const { phase, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");

    createScroller({ phase, roundIndex, target, scope });
    phase.value = "answering";
    roundIndex.value = 0;
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
    scope.stop();
  });

  it("does not scroll again for the same round and phase", async () => {
    const { phase, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    phase.value = "answering";
    roundIndex.value = 2;

    createScroller({ phase, roundIndex, target, scope });
    await nextTick();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    phase.value = "lobby";
    await nextTick();
    phase.value = "answering";
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("scrolls the scroll parent to the top when the round reveals", async () => {
    const { phase, roundIndex, target, scope } = createOptions();
    const scrollParent = document.createElement("main");
    scrollParent.style.overflowY = "auto";
    const section = document.createElement("section");
    scrollParent.appendChild(section);
    target.value = section;
    phase.value = "answering";
    roundIndex.value = 0;

    createScroller({ phase, roundIndex, target, scope });
    await nextTick();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    phase.value = "reveal";
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    scope.stop();
  });

  it("falls back to the document's scrolling element when no ancestor scrolls", async () => {
    const { phase, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    phase.value = "reveal";
    roundIndex.value = 0;

    createScroller({ phase, roundIndex, target, scope });
    await nextTick();

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("scrolls again for the next round", async () => {
    const { phase, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    phase.value = "answering";
    roundIndex.value = 0;

    createScroller({ phase, roundIndex, target, scope });
    await nextTick();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    roundIndex.value = 1;
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    scope.stop();
  });

  it("does not scroll during lobby or finished", async () => {
    const { phase, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    phase.value = "lobby";
    roundIndex.value = 0;

    createScroller({ phase, roundIndex, target, scope });
    await nextTick();
    phase.value = "finished";
    await nextTick();

    expect(scrollIntoView).not.toHaveBeenCalled();
    scope.stop();
  });

  it("scrolls once the target attaches after mounting mid-round", async () => {
    const { phase, roundIndex, target, scope } = createOptions();
    phase.value = "answering";
    roundIndex.value = 3;

    createScroller({ phase, roundIndex, target, scope });
    await nextTick();
    expect(scrollIntoView).not.toHaveBeenCalled();

    target.value = document.createElement("section");
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("skips smooth scrolling when motion is reduced", async () => {
    setReducedMotion(true);
    const { phase, roundIndex, target, scope } = createOptions();
    target.value = document.createElement("section");
    phase.value = "answering";
    roundIndex.value = 0;

    createScroller({ phase, roundIndex, target, scope });
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
    phase: ref<MusicQuizPhase | null>(null),
    roundIndex: ref<number | null>(null),
    target: ref<HTMLElement | null>(null) as Ref<HTMLElement | null>,
    scope: effectScope(),
  };
}

function createScroller({
  phase,
  roundIndex,
  target,
  scope,
}: ReturnType<typeof createOptions>) {
  scope.run(() =>
    useMusicQuizPhaseScroll({
      phase: () => phase.value,
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
