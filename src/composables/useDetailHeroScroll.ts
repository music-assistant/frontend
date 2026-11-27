import { useIntersectionObserver } from "@vueuse/core";
import { computed, ref, type Ref } from "vue";

// px, the pinned bar's h-14
const STICKY_BAR_HEIGHT = 56;

/**
 * Whether a detail hero's toolbar and title are still on screen, which decides
 * when its pinned bar shows and when the bar shows the name.
 */
export function useDetailHeroScroll(
  toolbarSentinel: Ref<HTMLElement | undefined>,
  heroBody: Ref<HTMLElement | undefined>,
) {
  const toolbarInView = ref(true);
  const titleInView = ref(true);
  // every hero puts its item name in the one h1 of its body
  const heroTitle = computed(
    () => heroBody.value?.querySelector<HTMLElement>("h1") ?? undefined,
  );

  useIntersectionObserver(toolbarSentinel, ([entry]) => {
    toolbarInView.value = entry?.isIntersecting ?? true;
  });
  // the page scroller starts below the safe area, as the pinned bar's content
  // does, so the title counts as gone once it is under the bar
  const pageScroller = computed(
    () => heroBody.value?.closest<HTMLElement>(".content-section") ?? undefined,
  );
  useIntersectionObserver(
    heroTitle,
    ([entry]) => {
      titleInView.value = entry?.isIntersecting ?? true;
    },
    { root: pageScroller, rootMargin: `-${STICKY_BAR_HEIGHT}px 0px 0px 0px` },
  );

  return { toolbarInView, titleInView };
}
