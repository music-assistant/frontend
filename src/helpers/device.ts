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
  // read off a padding rather than the custom property itself: WebKit reports 0
  // for a custom property holding env(), while a length it lays a box out with
  // carries the inset the page is actually drawn against
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-left:var(--device-inset-${side})`;
  document.body.appendChild(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingLeft) || 0;
  probe.remove();
  return inset;
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
