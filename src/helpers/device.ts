import MobileDetect from "mobile-detect";

export type DeviceType = "desktop" | "phone" | "tablet";

const md = new MobileDetect(window.navigator.userAgent);

// All resolved once from the user agent, so they never change while the app runs.
// The flags say nothing about the viewport and overlap: a phone or tablet is also
// mobile, while mobile on its own means the device could not be sized as either.
export const IS_TABLET_UA = Boolean(md.tablet());
export const IS_PHONE_UA = Boolean(md.phone());
export const IS_MOBILE_UA = Boolean(md.mobile());

export const DEVICE_TYPE: DeviceType = IS_TABLET_UA
  ? "tablet"
  : IS_PHONE_UA || IS_MOBILE_UA
    ? "phone"
    : "desktop";

/**
 * How far in from a side of the screen it is safe to draw, in pixels.
 *
 * The layout viewport spans the cutout and the rounded corners, so anything
 * measured from `window.innerWidth` has to take this off to clear them.
 */
export function deviceInset(side: "left" | "right") {
  return (
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        `--device-inset-${side}`,
      ),
    ) || 0
  );
}

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
