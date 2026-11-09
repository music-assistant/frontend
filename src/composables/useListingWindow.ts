import { until, useIntersectionObserver } from "@vueuse/core";
import { nextTick, type Ref } from "vue";

interface ListingWindowOptions {
  // the element the listing scrolls in
  scroller: () => HTMLElement | null;
  // shown above the rows while rows above them are not loaded
  topSentinel: Readonly<Ref<HTMLElement | null>>;
  // the rendered element of the loaded item at this index
  rowElement: (index: number) => HTMLElement | null;
  // how far above the visible area the rows above start loading
  margin: number;
  baseOffset: Ref<number>;
  loading: Ref<boolean>;
  isDisposed: () => boolean;
  loadRow: (row: number) => Promise<boolean>;
  loadPreviousPage: (onPrepend: () => void) => Promise<boolean>;
}

/**
 * Jumping to any row of a paged listing, and loading the rows above as the
 * list scrolls up from there, while the rows on screen stay where they are.
 */
export function useListingWindow(options: ListingWindowOptions) {
  let jumping = false;
  let jumpId = 0;
  let filling = false;

  useIntersectionObserver(
    options.topSentinel,
    (entries) => {
      if (entries.at(-1)?.isIntersecting) void fillAbove();
    },
    {
      root: options.scroller,
      rootMargin: `${options.margin}px 0px 0px 0px`,
    },
  );

  /**
   * Scroll the given listing row to the top, loading it first when needed.
   * A newer jump takes over from one still loading.
   */
  async function jumpToRow(row: number) {
    const id = ++jumpId;
    jumping = true;
    try {
      const loaded = await options.loadRow(row);
      if (!loaded || id !== jumpId || options.isDisposed()) return;
      await scrollToIndex(row - options.baseOffset.value);
    } finally {
      if (id === jumpId) jumping = false;
    }
    if (id === jumpId) void fillAbove();
  }

  /** Load every row above the loaded ones, keeping the rows on screen. */
  async function loadAllAbove() {
    while (options.baseOffset.value > 0 && !options.isDisposed()) {
      if (options.loading.value) {
        await until(options.loading).toBe(false);
      } else if (!(await prependPage())) {
        return;
      }
    }
  }

  return { jumpToRow, loadAllAbove };

  async function scrollToIndex(index: number) {
    const scroller = options.scroller();
    if (!scroller) return;
    // the virtual list may render the new rows a frame after the update
    for (let attempt = 0; attempt < 3; attempt++) {
      await nextTick();
      const el = options.rowElement(index);
      if (el) {
        scroller.scrollTop +=
          el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        return;
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  // keeps the rows on screen in place: the rows put in front add their
  // height above them
  async function prependPage() {
    const scroller = options.scroller();
    const added = await options.loadPreviousPage(() => {
      if (!scroller) return;
      // the page still shows the rows from before
      const top = scroller.scrollTop;
      const height = scroller.scrollHeight;
      nextTick(() => {
        scroller.scrollTop = top + scroller.scrollHeight - height;
      });
    });
    await nextTick();
    return added;
  }

  // loads pages above while the top of the rows is near the visible area;
  // the sentinel stays in view when a page is shorter than the margin
  async function fillAbove() {
    if (filling) return;
    filling = true;
    try {
      while (
        options.baseOffset.value > 0 &&
        !jumping &&
        !options.isDisposed() &&
        sentinelNearTop()
      ) {
        if (options.loading.value) {
          await until(options.loading).toBe(false);
        } else if (!(await prependPage())) {
          return;
        }
      }
    } finally {
      filling = false;
    }
  }

  function sentinelNearTop() {
    const sentinel = options.topSentinel.value;
    const scroller = options.scroller();
    if (!sentinel || !scroller) return false;
    return (
      sentinel.getBoundingClientRect().bottom >=
      scroller.getBoundingClientRect().top - options.margin
    );
  }
}
