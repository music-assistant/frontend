import {
  tryOnMounted,
  useEventListener,
  useRafFn,
  useResizeObserver,
} from "@vueuse/core";
import { ref, shallowRef, type MaybeRefOrGetter, toValue, watch } from "vue";

// where in the scroller the top row is sampled: past the left padding and
// just below the toolbar that sits over the first rows, then further down in
// case the first point falls in a gap between rows
const SAMPLE_X = 40;
const SAMPLE_YS = [60, 90, 120];

/**
 * The loaded index (data-listing-index) of the row at the top of the visible
 * area, kept up to date as the list scrolls and as its rows come and go.
 * Undefined while nothing is tracked, or when no row is at the top.
 */
export function useTopListingRow(
  scroller: () => HTMLElement | null,
  content: MaybeRefOrGetter<HTMLElement | null | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  const topIndex = ref<number | undefined>();
  // the scroller is an ancestor, in the document only once everything is mounted
  const scrollerEl = shallowRef<HTMLElement | null>(null);
  tryOnMounted(() => {
    scrollerEl.value = scroller();
  });

  function measure() {
    const el = scrollerEl.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let index: number | undefined;
    for (const y of SAMPLE_YS) {
      const hit = document
        .elementFromPoint(rect.left + SAMPLE_X, rect.top + y)
        ?.closest<HTMLElement>("[data-listing-index]");
      if (!hit) continue;
      index = Number(hit.dataset.listingIndex);
      break;
    }
    topIndex.value = Number.isFinite(index) ? index : undefined;
  }

  // one measurement per frame, however many scroll events arrive
  const { resume, pause } = useRafFn(
    () => {
      pause();
      measure();
    },
    { immediate: false },
  );

  useEventListener(scrollerEl, "scroll", resume, { passive: true });
  // rows loading in, or a change of view, move what is at the top
  useResizeObserver(content, resume);

  watch(
    [() => toValue(enabled), scrollerEl],
    ([on]) => {
      if (on) resume();
      else topIndex.value = undefined;
    },
    { immediate: true },
  );

  return { topIndex, measure };
}
