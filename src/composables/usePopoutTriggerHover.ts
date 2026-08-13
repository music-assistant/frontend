import { readonly, ref, watch } from "vue";

/**
 * Hover state for the button that opens a player bar popout.
 *
 * Bind `suppressHover` to the button's `data-suppress-hover` and `releaseHover`
 * to its `pointerenter`.
 *
 * @param isOpen - whether the popout the button owns is showing
 */
export function usePopoutTriggerHover(isOpen: () => boolean) {
  // touch browsers keep hovering whatever was tapped last, so the tap that
  // opened the popout leaves the button reading as active once the popout is
  // gone, however it was dismissed. Only the pointer arriving on the button
  // again says anything about where it really is.
  const suppressHover = ref(false);

  watch(isOpen, (open) => {
    if (!open) suppressHover.value = true;
  });

  return {
    suppressHover: readonly(suppressHover),
    releaseHover: () => {
      suppressHover.value = false;
    },
  };
}
