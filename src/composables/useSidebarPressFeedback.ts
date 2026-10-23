import { onBeforeUnmount, ref, toValue, type MaybeRefOrGetter } from "vue";

const PRESS_FEEDBACK_DURATION_MS = 650;

export function useSidebarPressFeedback(
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const pressFeedbackActive = ref(false);
  let pressFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let lastFeedbackAt = 0;

  function activatePressFeedback(element: HTMLElement) {
    if (
      !toValue(enabled) ||
      element.matches(":disabled, [aria-disabled='true']")
    ) {
      return;
    }

    pressFeedbackActive.value = true;
    if (pressFeedbackTimer) clearTimeout(pressFeedbackTimer);
    pressFeedbackTimer = setTimeout(() => {
      pressFeedbackActive.value = false;
      pressFeedbackTimer = undefined;
    }, PRESS_FEEDBACK_DURATION_MS);
  }

  function triggerPressFeedback(element: HTMLElement) {
    const now = Date.now();
    if (now - lastFeedbackAt < 100) return;
    lastFeedbackAt = now;
    activatePressFeedback(element);
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    triggerPressFeedback(event.currentTarget as HTMLElement);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    triggerPressFeedback(event.currentTarget as HTMLElement);
  }

  function handleClick(event: MouseEvent) {
    triggerPressFeedback(event.currentTarget as HTMLElement);
  }

  onBeforeUnmount(() => {
    if (pressFeedbackTimer) clearTimeout(pressFeedbackTimer);
  });

  return {
    pressFeedbackActive,
    handlePointerDown,
    handleKeyDown,
    handleClick,
  };
}
