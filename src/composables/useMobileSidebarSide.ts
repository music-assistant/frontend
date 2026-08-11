import { readonly, ref, type DeepReadonly, type Ref } from "vue";
import {
  MOBILE_SIDEBAR_SIDE_KEY,
  subscribeToDeviceSetting,
} from "@/helpers/device_settings";

export type MobileSidebarSide = "left" | "right";

const mobileSidebarSide = ref<MobileSidebarSide>(readStoredSide());

subscribeToDeviceSetting(MOBILE_SIDEBAR_SIDE_KEY, () => {
  mobileSidebarSide.value = readStoredSide();
});

/**
 * The side the navigation sheet opens from on mobile.
 *
 * Shared by every consumer so changing the setting applies without a reload.
 */
export function useMobileSidebarSide(): DeepReadonly<Ref<MobileSidebarSide>> {
  return readonly(mobileSidebarSide);
}

function readStoredSide(): MobileSidebarSide {
  if (typeof localStorage === "undefined") return "left";
  return localStorage.getItem(MOBILE_SIDEBAR_SIDE_KEY) === "right"
    ? "right"
    : "left";
}
