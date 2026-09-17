import { store } from "@/plugins/store";
import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from "vue";

/** Back is a fallback: controls and dismissible UI always get Escape first. */
export function useEscapeBack(
  navigateBack: () => void,
  enabled: () => boolean = () => true,
) {
  const blockedEvents = new WeakSet<KeyboardEvent>();
  const editableSelector = [
    "input",
    "select",
    "textarea",
    '[contenteditable]:not([contenteditable="false"])',
    '[role="combobox"]',
    '[role="searchbox"]',
    '[role="slider"]',
    '[role="spinbutton"]',
    '[role="textbox"]',
  ].join(",");
  const overlaySelector = [
    ".v-overlay--active",
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[data-slot="popover-content"]',
  ].join(",");

  const isBlocked = (event: KeyboardEvent) => {
    if (
      !enabled() ||
      store.dialogActive ||
      store.showPlayersMenu ||
      store.showFullscreenPlayer
    ) {
      return true;
    }
    if (
      [...event.composedPath(), document.activeElement].some(
        (target) =>
          target instanceof Element && target.closest(editableSelector),
      )
    ) {
      return true;
    }
    return [...document.querySelectorAll(overlaySelector)].some((overlay) => {
      if (
        overlay.closest('[hidden], [aria-hidden="true"], [data-state="closed"]')
      ) {
        return false;
      }
      // Include hidden ancestors (v-show), but not geometry: jsdom and some
      // teleported/transitioning overlays do not have a useful bounding box.
      for (
        let node: Element | null = overlay;
        node;
        node = node.parentElement
      ) {
        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden")
          return false;
      }
      return true;
    });
  };

  const capture = (event: KeyboardEvent) => {
    // Remember UI that may be synchronously dismissed by a later listener.
    if (event.key === "Escape" && isBlocked(event)) blockedEvents.add(event);
  };
  const handle = (event: KeyboardEvent) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      blockedEvents.has(event) ||
      isBlocked(event)
    ) {
      return;
    }
    event.preventDefault();
    navigateBack();
  };
  const attach = () => {
    window.addEventListener("keydown", capture, true);
    // Document-level search/menu handlers run before this bubble listener,
    // regardless of which component mounted first.
    window.addEventListener("keydown", handle);
  };
  const detach = () => {
    window.removeEventListener("keydown", capture, true);
    window.removeEventListener("keydown", handle);
  };
  onMounted(attach);
  onActivated(attach);
  onDeactivated(detach);
  onBeforeUnmount(detach);
}
