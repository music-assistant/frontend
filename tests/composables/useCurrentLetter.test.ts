import { useCurrentLetter } from "@/composables/useCurrentLetter";
import { afterEach, describe, expect, it } from "vitest";
import { effectScope, nextTick, ref, type EffectScope } from "vue";

const scopes: EffectScope[] = [];

const ROW_HEIGHT = 60;
const SCROLLER_HEIGHT = 600;

// rows 0-9 are "A", 10-19 "B", from 20 on "C"
const letterAt = (row: number) => (row < 10 ? "A" : row < 20 ? "B" : "C");

function rect(top: number, height: number) {
  return { top, height, bottom: top + height } as DOMRect;
}

// a scroller whose rows sit at their index times the row height, minus the
// scroll position
function setup() {
  const scrollTop = ref(0);
  const scroller = {
    getBoundingClientRect: () => rect(0, SCROLLER_HEIGHT),
    get scrollTop() {
      return scrollTop.value;
    },
    clientHeight: SCROLLER_HEIGHT,
    scrollHeight: 100 * ROW_HEIGHT,
  } as unknown as HTMLElement;
  const rowElement = (index: number) =>
    ({
      getBoundingClientRect: () =>
        rect(index * ROW_HEIGHT - scrollTop.value, ROW_HEIGHT),
    }) as HTMLElement;
  const topIndex = ref<number | undefined>(0);
  const entries = ref<unknown>([]);
  const scope = effectScope();
  scopes.push(scope);
  const letter = scope.run(() =>
    useCurrentLetter({
      scroller: () => scroller,
      bar: () => undefined,
      rowElement,
      baseOffset: ref(0),
      topIndex,
      letterAt,
      entries,
    }),
  )!;
  // scroll so this row is at the top of the screen, a share of it scrolled past
  const scrollTo = async (row: number, past = 0) => {
    scrollTop.value = (row + past) * ROW_HEIGHT;
    topIndex.value = row;
    await nextTick();
  };
  return { ...letter, scrollTo, entries };
}

describe("useCurrentLetter", () => {
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
  });

  it("marks the letter of the row at the top", async () => {
    const { currentLetter, scrollTo } = setup();
    await scrollTo(12);

    expect(currentLetter.value).toBe("B");
  });

  it("keeps the jumped letter lit while its row stays in place", async () => {
    const { currentLetter, markJump, scrollTo } = setup();
    // the jump to "B" lands with part of the last "A" row still at the top
    markJump(10);
    await scrollTo(9, 0.5);

    expect(currentLetter.value).toBe("B");
  });

  it("ends the jump once the list scrolls away from its row", async () => {
    const { currentLetter, markJump, scrollTo } = setup();
    markJump(10);
    await scrollTo(9, 0.5);

    await scrollTo(30);
    expect(currentLetter.value).toBe("C");

    // coming back past the row does not light its letter again
    await scrollTo(9, 0.5);
    expect(currentLetter.value).toBe("A");
  });

  it("forgets the jump when the letter index changes", async () => {
    const { currentLetter, markJump, scrollTo, entries } = setup();
    markJump(10);
    await scrollTo(9, 0.5);

    entries.value = [];
    await nextTick();

    expect(currentLetter.value).toBe("A");
  });
});
