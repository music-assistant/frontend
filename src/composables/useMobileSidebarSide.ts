import {
  MOBILE_SIDEBAR_SIDE,
  readDeviceSetting,
  subscribeToDeviceSetting,
} from "@/helpers/device_settings";
import { readonly, ref, type DeepReadonly, type Ref } from "vue";

export type MobileSidebarSide = "left" | "right";

const mobileSidebarSide = ref<MobileSidebarSide>(readStoredSide());

subscribeToDeviceSetting(MOBILE_SIDEBAR_SIDE, () => {
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
  return readDeviceSetting(MOBILE_SIDEBAR_SIDE) === "right" ? "right" : "left";
}
