/**
 * Whether an outside interaction Reka reports on a dialog landed inside a
 * Vuetify overlay, such as the menu of a select or a date picker in its form.
 * Those teleport outside the dialog's DOM, so a dialog that holds such a form
 * keeps itself open for them.
 */
export function isInVuetifyOverlay(event: Event): boolean {
  const original = (event as CustomEvent).detail?.originalEvent as
    Event | undefined;
  const target = (original?.target ?? event.target) as HTMLElement | null;
  return !!target?.closest?.(".v-overlay-container, .v-overlay, .v-menu");
}
