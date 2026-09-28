import { deviceInset } from "@/helpers/device";
import { afterEach, describe, expect, it } from "vitest";

// Each side carries its own value, so reaching for the wrong one reads as the
// wrong number instead of quietly passing.
const INSET_LEFT = "77px";
const INSET_RIGHT = "44px";
const INSET_TOP = "55px";

describe("deviceInset", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  it("reports the room each side of the screen reserves", () => {
    document.documentElement.style.setProperty(
      "--device-inset-left",
      INSET_LEFT,
    );
    document.documentElement.style.setProperty(
      "--device-inset-right",
      INSET_RIGHT,
    );
    document.documentElement.style.setProperty("--device-inset-top", INSET_TOP);

    expect(deviceInset("left")).toBe(parseFloat(INSET_LEFT));
    expect(deviceInset("right")).toBe(parseFloat(INSET_RIGHT));
    expect(deviceInset("top")).toBe(parseFloat(INSET_TOP));
  });

  it("reports no room where the screen reserves none", () => {
    expect(deviceInset("left")).toBe(0);
    expect(deviceInset("right")).toBe(0);
    expect(deviceInset("top")).toBe(0);
  });

  // It is read once per popout that opens, so anything it leaves behind piles
  // up for as long as the app is on screen.
  it("leaves nothing behind to measure against", () => {
    deviceInset("left");
    deviceInset("right");
    deviceInset("top");

    expect(document.body.children).toHaveLength(0);
  });
});
