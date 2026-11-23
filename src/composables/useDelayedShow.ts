import { onScopeDispose, ref, watch, type Ref } from "vue";

/**
 * Follows `source`, but only turns on once it has stayed on for `delayMs`.
 * It turns off straight away, so a short blip never shows at all.
 */
export function useDelayedShow(source: Ref<boolean>, delayMs: number) {
  const shown = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(
    source,
    (isOn) => {
      clearTimeout(timer);
      if (!isOn) {
        shown.value = false;
        return;
      }
      if (shown.value) return;
      timer = setTimeout(() => (shown.value = true), delayMs);
    },
    { immediate: true },
  );

  onScopeDispose(() => clearTimeout(timer));

  return shown;
}
