import { store } from "@/plugins/store";

const LAYER_SELECTOR = "[data-dismissable-layer]";

/**
 * Handler for a reka-ui `@open-auto-focus` event that keeps a dialog or a
 * popover from focusing its first field on a touch device.
 *
 * Use it on anything that opens with a search or text field: focusing that
 * field raises the on-screen keyboard, which then covers most of the content.
 * Focus moves to the dialog or popover itself instead, so the focus handling
 * and the screen reader announcement stay intact. Devices without a
 * touchscreen keep the default behaviour and land in the field.
 */
export function preventOnScreenKeyboardOnOpen(event: Event) {
  if (!store.isTouchscreen) return;
  if (!(event.target instanceof HTMLElement)) return;
  // a popover reports the event on its positioning wrapper, which sits outside
  // the dismissable layer: focusing it counts as a focus outside and closes the
  // popover, so aim for the layer itself. A dialog is that layer already.
  const layer = event.target.matches(LAYER_SELECTOR)
    ? event.target
    : event.target.querySelector<HTMLElement>(LAYER_SELECTOR);
  if (!layer) return;
  event.preventDefault();
  layer.focus({ preventScroll: true });
}
