import { createContext } from "reka-ui";
import type { ComputedRef, Ref } from "vue";

export const SIDEBAR_COOKIE_NAME = "sidebar_state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = "17.5rem";
export const SIDEBAR_WIDTH_MOBILE = "18rem";
// Match the desktop footer artwork (46px) plus the footer's horizontal
// padding (16px on each side).
export const SIDEBAR_WIDTH_ICON = "4.65rem";
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";

export const [useSidebar, provideSidebarContext] = createContext<{
  state: ComputedRef<"expanded" | "collapsed">;
  open: Ref<boolean>;
  setOpen: (value: boolean) => void;
  isMobile: Ref<boolean>;
  openMobile: Ref<boolean>;
  setOpenMobile: (value: boolean) => void;
  toggleSidebar: () => void;
}>("Sidebar");
