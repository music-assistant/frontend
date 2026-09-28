import type { MediaType } from "@/plugins/api/interfaces";
import { ref } from "vue";

const isOpen = ref(false);
const initialQuery = ref("");
const initialMediaTypes = ref<MediaType[]>([]);
// true when a caller opened the palette with options (even an empty query); a
// bare open (the ⌘K shortcut, the sidebar) leaves it false so the palette
// restores its previous search instead of clearing it
const initialSeeded = ref(false);

export const isMacPlatform =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

export const commandCenterHotkeyLabel = isMacPlatform ? "⌘K" : "Ctrl K";

export interface CommandCenterOpenOptions {
  query?: string;
  mediaTypes?: MediaType[];
}

const open = function (options?: CommandCenterOpenOptions) {
  initialQuery.value = options?.query?.trim() || "";
  initialMediaTypes.value = options?.mediaTypes ? [...options.mediaTypes] : [];
  // a caller handing over options wants a fresh search, even an empty one; only
  // a bare open (the ⌘K shortcut, the sidebar) restores the previous search
  initialSeeded.value = options !== undefined;
  isOpen.value = true;
};

const close = function () {
  isOpen.value = false;
};

export function useCommandCenter() {
  return {
    isOpen,
    initialQuery,
    initialMediaTypes,
    initialSeeded,
    open,
    close,
    toggle: (options?: CommandCenterOpenOptions) => {
      if (isOpen.value) close();
      else open(options);
    },
  };
}
