import { store } from "@/plugins/store";

/**
 * Handler for a reka-ui `@open-auto-focus` event that keeps a dialog from
 * focusing its first field on a touch device.
 *
 * Use it on any dialog that opens with a search or text field: focusing that
 * field raises the on-screen keyboard, which then covers most of the dialog.
 * Focus moves to the dialog itself instead, so the focus trap and the screen
 * reader announcement stay intact. Devices without a touchscreen keep the
 * default behaviour and land in the field.
 *
 * Dialogs only. A popover is not focus trapped, so moving focus to its content
 * root dismisses it; use `@open-auto-focus.prevent` there instead.
 */
export function preventOnScreenKeyboardOnOpen(event: Event) {
  if (!store.isTouchscreen) return;
  event.preventDefault();
  if (event.target instanceof HTMLElement) {
    event.target.focus({ preventScroll: true });
  }
}
