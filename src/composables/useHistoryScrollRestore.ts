import { returnedByHistory } from "@/helpers/navigation";
import { onBeforeUnmount, watch, type Ref } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from "vue-router";

// how long the restore holds the page in place while rows load, or gives up
// when the page never grows tall enough, e.g. a row failed to load
const RESTORE_TIMEOUT_MS = 5000;

const savedPositions = new Map<string, number>();

/**
 * Brings a view back to where it was scrolled when the user returns to it
 * through history, once its content has loaded far enough to get there.
 *
 * `returning()` is true for the whole visit that came back through history,
 * so the view can skip its own reset to the top, also after the restore.
 */
export function useHistoryScrollRestore(content: Ref<HTMLElement | undefined>) {
  const route = useRoute();
  const router = useRouter();
  let stopRestore: (() => void) | undefined;
  let returning = false;

  // a history entry, so a later visit to the same URL keeps its own position;
  // taken on arrival because going back has already moved history on leave
  let entryKey = "";

  const save = () => {
    const scroller = getScroller();
    if (scroller) savedPositions.set(entryKey, scroller.scrollTop);
  };
  onBeforeRouteLeave(save);
  onBeforeRouteUpdate(save);

  watch(
    () => route.fullPath,
    (fullPath) => {
      stopRestore?.();
      returning = false;
      entryKey = `${router.options.history.state.position}:${fullPath}`;
      const top = savedPositions.get(entryKey);
      if (top && returnedByHistory(router)) {
        returning = true;
        startRestore(top);
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => stopRestore?.());

  function startRestore(top: number) {
    const scroller = getScroller();
    if (!scroller) return;
    const tryRestore = () => {
      if (scroller.scrollHeight - scroller.clientHeight < top) return;
      // keeps going until the timeout, as rows above can still shrink once loaded
      scroller.scrollTop = top;
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
    // the user scrolling on their own wins over the restore; pointerdown
    // covers touch and dragging the scrollbar
    const userEvents = ["wheel", "pointerdown"] as const;
    const cancel = () => stopRestore?.();
    userEvents.forEach((e) => scroller.addEventListener(e, cancel));
    // focus is often on the body after going back, outside the scroller
    document.addEventListener("keydown", cancel);
    stopRestore = () => {
      observer.disconnect();
      stopObserve();
      clearTimeout(timeout);
      userEvents.forEach((e) => scroller.removeEventListener(e, cancel));
      document.removeEventListener("keydown", cancel);
      stopRestore = undefined;
    };
  }

  return { returning: () => returning };
}

/** The scroll container most views share. */
function getScroller(): HTMLElement | null {
  return document.querySelector(".content-section");
}
