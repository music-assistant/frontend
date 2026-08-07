import MobileDetect from "mobile-detect";

export type DeviceType = "desktop" | "phone" | "tablet";

const md = new MobileDetect(window.navigator.userAgent);

// resolved once from the user agent, so it never changes while the app runs
export const DEVICE_TYPE: DeviceType = md.tablet()
  ? "tablet"
  : md.phone() || md.mobile()
    ? "phone"
    : "desktop";

export function isTouchscreenDevice() {
  // detect if device/browser is touch enabled
  let result = false;
  if (window.PointerEvent && "maxTouchPoints" in navigator) {
    if (navigator.maxTouchPoints > 0) {
      result = true;
    }
  } else {
    if (
      window.matchMedia &&
      window.matchMedia("(any-pointer:coarse)").matches
    ) {
      result = true;
    } else if (window.TouchEvent || "ontouchstart" in window) {
      result = true;
    }
  }
  return result;
}
