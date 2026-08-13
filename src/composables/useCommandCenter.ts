import { ref } from "vue";

const isOpen = ref(false);

export const isMacPlatform =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

export const commandCenterHotkeyLabel = isMacPlatform ? "⌘K" : "Ctrl K";

export function useCommandCenter() {
  return {
    isOpen,
    open: () => {
      isOpen.value = true;
    },
    close: () => {
      isOpen.value = false;
    },
    toggle: () => {
      isOpen.value = !isOpen.value;
    },
  };
}
