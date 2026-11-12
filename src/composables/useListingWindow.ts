import type { useItemsListing } from "@/composables/useItemsListing";
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
  // the paged listing whose rows are loaded
  listing: Pick<
    ReturnType<typeof useItemsListing>,
    "baseOffset" | "loading" | "isDisposed" | "loadRow" | "loadPreviousPage"
  >;
}

/**
 * Jumping to any row of a paged listing, and loading the rows above as the
 * list scrolls up from there, while the rows on screen stay where they are.
 */
export function useListingWindow(options: ListingWindowOptions) {
  const { listing } = options;
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
      const loaded = await listing.loadRow(row);
      if (!loaded || id !== jumpId || listing.isDisposed()) return;
      await scrollToIndex(row - listing.baseOffset.value);
    } finally {
      if (id === jumpId) jumping = false;
    }
    if (id === jumpId) void fillAbove();
  }

  /** Load every row above the loaded ones, keeping the rows on screen. */
  function loadAllAbove() {
    return loadAbove(() => true);
  }

  return { jumpToRow, loadAllAbove };

  async function scrollToIndex(index: number) {
    const id = jumpId;
    const scroller = options.scroller();
    if (!scroller) return;
    await nextTick();
    // the virtual list may render the new rows a frame after the update
    for (let attempt = 0; attempt < 3; attempt++) {
      if (id !== jumpId || listing.isDisposed()) return;
      const el = options.rowElement(index);
      if (el) {
        scroller.scrollTop +=
          el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        return;
      }
      await nextFrame();
    }
  }

  // keeps the rows on screen in place: the rows put in front add their
  // height above them
  async function prependPage() {
    const scroller = options.scroller();
    let kept: Promise<void> | undefined;
    const added = await listing.loadPreviousPage(() => {
      if (!scroller) return;
      // the page still shows the rows from before
      const top = scroller.scrollTop;
      const height = scroller.scrollHeight;
      kept = nextFrame().then(() => {
        scroller.scrollTop = top + scroller.scrollHeight - height;
      });
    });
    await kept;
    return added;
  }

  // the list view draws rows for changed items in the next animation frame,
  // which still runs before the page is painted
  async function nextFrame() {
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  // loads pages above while the top of the rows is near the visible area;
  // the sentinel stays in view when a page is shorter than the margin
  async function fillAbove() {
    if (filling) return;
    filling = true;
    try {
      await loadAbove(() => !jumping && sentinelNearTop());
    } finally {
      filling = false;
    }
  }

  // loads pages above the rows while keepGoing allows it
  async function loadAbove(keepGoing: () => boolean) {
    while (
      listing.baseOffset.value > 0 &&
      !listing.isDisposed() &&
      keepGoing()
    ) {
      if (listing.loading.value) {
        await until(listing.loading).toBe(false);
      } else if (!(await prependPage())) {
        return;
      }
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
