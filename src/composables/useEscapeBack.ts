import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted } from "vue";

// the input of a Vuetify select takes no typing (inputmode="none"), so once its
// list is closed Escape is free to go back
const EDITABLE =
  'input:not([inputmode="none"]), select, textarea, [contenteditable]:not([contenteditable="false"])';
const OVERLAY =
  '.v-overlay--active, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-slot="popover-content"]';
const HIDDEN =
  '[hidden], [aria-hidden="true"], [data-state="closed"], [style*="display: none"]';

/**
 * Navigate back on Escape while the calling view is mounted.
 *
 * Fields, open overlays and dialogs always get Escape first; back is only the fallback.
 */
export function useEscapeBack(
  navigateBack: () => void,
  enabled: () => boolean = () => true,
) {
  const blockedEvents = new WeakSet<KeyboardEvent>();

  const isBlocked = (event: KeyboardEvent) => {
    if (
      !enabled() ||
      store.dialogActive ||
      store.showPlayersMenu ||
      store.showFullscreenPlayer
    )
      return true;
    const target = event.target;
    if (target instanceof Element && target.closest(EDITABLE)) return true;
    return [...document.querySelectorAll(OVERLAY)].some(
      (overlay) => !overlay.closest(HIDDEN),
    );
  };

  // reka and the fullscreen player close on the same keypress from window
  // listeners that may run first, so decide before any of them act
  const capture = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isBlocked(event)) blockedEvents.add(event);
  };
  const handle = (event: KeyboardEvent) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.repeat ||
      blockedEvents.has(event) ||
      isBlocked(event)
    )
      return;
    event.preventDefault();
    navigateBack();
  };

  onMounted(() => {
    window.addEventListener("keydown", capture, true);
    window.addEventListener("keydown", handle);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("keydown", capture, true);
    window.removeEventListener("keydown", handle);
  });
}
