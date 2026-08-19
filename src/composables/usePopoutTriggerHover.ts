import { readonly, ref, watch } from "vue";

/**
 * Hover state for the button that opens a player bar popout.
 *
 * Bind `suppressHover` to the button's `data-suppress-hover` and
 * `onPointerEnter` to its `pointerenter`.
 *
 * @param isOpen - whether the popout the button owns is showing
 */
export function usePopoutTriggerHover(isOpen: () => boolean) {
  // touch browsers keep hovering whatever was tapped last, so the tap that
  // opened the popout leaves the button reading as active once the popout is
  // gone, however it was dismissed. A mouse is the exception: it is still
  // genuinely on the button after clicking the popout shut, and a click brings
  // no fresh pointerenter that could say so.
  const suppressHover = ref(false);
  // a finger landing on the button announces itself with its own pointerenter,
  // so this needs no clearing when the mouse leaves
  let lastPointerWasMouse = false;

  watch(isOpen, (open) => {
    if (!open) suppressHover.value = !lastPointerWasMouse;
  });

  return {
    suppressHover: readonly(suppressHover),
    onPointerEnter: (event: PointerEvent) => {
      lastPointerWasMouse = event.pointerType === "mouse";
      suppressHover.value = false;
    },
  };
}
