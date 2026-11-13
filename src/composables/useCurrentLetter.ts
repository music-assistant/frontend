import { computed, ref, watch, type Ref } from "vue";

interface CurrentLetterOptions {
  scroller: () => HTMLElement | null;
  bar: () => HTMLElement | null | undefined;
  rowElement: (index: number) => HTMLElement | null;
  baseOffset: Ref<number>;
  topIndex: Ref<number | undefined>;
  letterAt: (row: number) => string | undefined;
  entries: Ref<unknown>;
}

/**
 * The letter of the row at the top of the screen, or the letter jumped to
 * while its row stays where the jump put it.
 */
export function useCurrentLetter(options: CurrentLetterOptions) {
  const { scroller, bar, rowElement, baseOffset, topIndex, letterAt } = options;
  const jumpedRow = ref<number>();

  // a new index comes with a new order
  watch(options.entries, () => {
    jumpedRow.value = undefined;
  });

  // at the top within its own height, or anywhere on screen at the list's end
  const jumpedRowInPlace = function (jumped: number) {
    const el = rowElement(jumped - baseOffset.value);
    const area = scroller();
    if (!el || !area) return false;
    const top = area.getBoundingClientRect().top;
    const bottom = (bar() ?? area).getBoundingClientRect().bottom;
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= top || rect.top >= bottom) return false;
    const atEnd = area.scrollTop + area.clientHeight >= area.scrollHeight - 1;
    return atEnd || rect.top < top + rect.height;
  };

  // once scrolled away from, the jump is over
  watch(topIndex, () => {
    const jumped = jumpedRow.value;
    if (jumped !== undefined && !jumpedRowInPlace(jumped)) {
      jumpedRow.value = undefined;
    }
  });

  const currentLetter = computed(() => {
    if (topIndex.value === undefined) return null;
    const jumped = jumpedRow.value;
    const row =
      jumped !== undefined && jumpedRowInPlace(jumped)
        ? jumped
        : baseOffset.value + topIndex.value;
    return letterAt(row) ?? null;
  });

  const markJump = (row: number) => {
    jumpedRow.value = row;
  };

  return { currentLetter, markJump };
}
