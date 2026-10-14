import { returnedByHistory } from "@/helpers/navigation";
import { onBeforeUnmount, watch, type Ref } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
  type RouteLocationNormalized,
} from "vue-router";

// gives up when the page never grows tall enough, e.g. a row failed to load
const RESTORE_TIMEOUT_MS = 5000;

const savedPositions = new Map<string, number>();

/**
 * Brings a view back to where it was scrolled when the user returns to it
 * through history, once its content has loaded far enough to get there.
 *
 * `restoring()` is true until that position is reached, so the view can skip
 * its own reset to the top in the meantime.
 */
export function useHistoryScrollRestore(content: Ref<HTMLElement | undefined>) {
  const route = useRoute();
  const router = useRouter();
  let stopRestore: (() => void) | undefined;

  const save = (from: RouteLocationNormalized) => {
    const scroller = getScroller();
    if (scroller) savedPositions.set(from.fullPath, scroller.scrollTop);
  };
  onBeforeRouteLeave((_to, from) => save(from));
  onBeforeRouteUpdate((_to, from) => save(from));

  watch(
    () => route.fullPath,
    (fullPath) => {
      stopRestore?.();
      const top = savedPositions.get(fullPath);
      if (top && returnedByHistory(router)) startRestore(top);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => stopRestore?.());

  function startRestore(top: number) {
    const scroller = getScroller();
    if (!scroller) return;
    const tryRestore = () => {
      if (scroller.scrollHeight - scroller.clientHeight < top) return;
      scroller.scrollTop = top;
      stopRestore?.();
    };
    const observer = new ResizeObserver(tryRestore);
    // the view's root may not be rendered yet when the route changes
    const stopObserve = watch(
      content,
      (el) => {
        observer.disconnect();
        if (el) observer.observe(el);
      },
      { immediate: true },
    );
    const timeout = setTimeout(() => {
      scroller.scrollTop = top;
      stopRestore?.();
    }, RESTORE_TIMEOUT_MS);
    // the user scrolling on their own wins over the restore
    const userEvents = ["wheel", "touchstart", "keydown"] as const;
    const cancel = () => stopRestore?.();
    userEvents.forEach((e) => scroller.addEventListener(e, cancel));
    stopRestore = () => {
      observer.disconnect();
      stopObserve();
      clearTimeout(timeout);
      userEvents.forEach((e) => scroller.removeEventListener(e, cancel));
      stopRestore = undefined;
    };
  }

  return { restoring: () => stopRestore !== undefined };
}

/** The scroll container most views share. */
function getScroller(): HTMLElement | null {
  return document.querySelector(".content-section");
}
