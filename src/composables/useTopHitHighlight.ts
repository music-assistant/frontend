import { useEventListener } from "@vueuse/core";
import { nextTick, ref, watch, type MaybeRefOrGetter, toValue } from "vue";

const NAVIGATION_KEYS = new Set(["ArrowUp", "ArrowDown", "Home", "End"]);
const OPTION_SELECTOR = "[role=option]";
const HIGHLIGHTED_SELECTOR = "[data-highlighted]";

interface TopHitHighlightOptions {
  list: () => HTMLElement | undefined;
  input: () => HTMLElement | undefined;
  // changes whenever another row lands on top
  topRowKey: () => string;
  // a change forgets the row the user moved to, such as a new term
  resetKey: () => unknown;
  enabled: MaybeRefOrGetter<boolean>;
}

/**
 * Keeps the first row of a reka listbox highlighted as rows land above the
 * highlighted one, so enter opens the top hit. A row the user moved to with
 * the arrow keys or the mouse stays highlighted.
 */
export function useTopHitHighlight(options: TopHitHighlightOptions) {
  const userMoved = ref(false);
  let highlighting = false;

  useEventListener(options.input, "keydown", (event: KeyboardEvent) => {
    if (!highlighting && NAVIGATION_KEYS.has(event.key)) userMoved.value = true;
  });
  useEventListener(options.list, "pointermove", (event: PointerEvent) => {
    const target = event.target as Element | null;
    if (target?.closest(OPTION_SELECTOR)) userMoved.value = true;
  });

  watch(options.resetKey, () => {
    userMoved.value = false;
  });

  watch(options.topRowKey, async () => {
    if (!toValue(options.enabled)) return;
    await nextTick();
    const listEl = options.list();
    const inputEl = options.input();
    if (!listEl || !inputEl) return;
    const first = listEl.querySelector(OPTION_SELECTOR);
    const highlighted = listEl.querySelector(HIGHLIGHTED_SELECTOR);
    if (!first || highlighted === first) return;
    if (highlighted && userMoved.value) return;
    // moving the highlight scrolls to it, so a list the user scrolled stays put
    if (listEl.scrollTop > 0) return;
    // reka moves the highlight to the first row on Home
    highlighting = true;
    inputEl.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    highlighting = false;
  });
}
