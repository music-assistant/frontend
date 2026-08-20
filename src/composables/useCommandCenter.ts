import type { MediaType } from "@/plugins/api/interfaces";
import { ref } from "vue";

const isOpen = ref(false);
const initialQuery = ref("");
const initialMediaTypes = ref<MediaType[]>([]);

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
    open,
    close,
    toggle: (options?: CommandCenterOpenOptions) => {
      if (isOpen.value) close();
      else open(options);
    },
  };
}
