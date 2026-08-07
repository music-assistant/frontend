import MobileDetect from "mobile-detect";

export type DeviceType = "desktop" | "phone" | "tablet";

const md = new MobileDetect(window.navigator.userAgent);

// All resolved once from the user agent, so they never change while the app runs.
// The three flags say nothing about the viewport and overlap: a phone or tablet is
// also mobile, while mobile on its own covers devices too obscure to classify further.
export const IS_TABLET_UA = Boolean(md.tablet());
export const IS_PHONE_UA = Boolean(md.phone());
export const IS_MOBILE_UA = Boolean(md.mobile());

export const DEVICE_TYPE: DeviceType = IS_TABLET_UA
  ? "tablet"
  : IS_PHONE_UA || IS_MOBILE_UA
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
