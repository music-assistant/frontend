import { store } from "@/plugins/store";

const LAYER_SELECTOR = "[data-dismissable-layer]";
const COMMAND_INPUT_SELECTOR = '[data-slot="command-input"]';

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
  // a popover reports the event on its positioning wrapper, which carries no
  // tabindex and so cannot take focus: aim for the layer nested inside it. A
  // dialog is that layer already.
  const layer = event.target.matches(LAYER_SELECTOR)
    ? event.target
    : event.target.querySelector<HTMLElement>(LAYER_SELECTOR);
  if (!layer) return;
  event.preventDefault();
  layer.focus({ preventScroll: true });
}

export function focusCommandInputOnOpen(event: Event) {
  if (!(event.target instanceof HTMLElement)) return;
  const input = event.target.querySelector<HTMLElement>(COMMAND_INPUT_SELECTOR);
  if (!input) return;
  event.preventDefault();
  input.focus();
}
