import {
  setStatusBarColorOverride,
  setStatusBarThemeColor,
} from "@/composables/useStatusBarColor";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("useStatusBarColor", () => {
  let meta: HTMLMetaElement;

  beforeEach(() => {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
    setStatusBarThemeColor("#181818");
    setStatusBarColorOverride(undefined);
  });

  afterEach(() => {
    meta.remove();
    document.documentElement.style.removeProperty("background-color");
  });

  it("leaves the html background to the theme stylesheet without an override", () => {
    expect(document.documentElement.style.backgroundColor).toBe("");
    expect(meta.content).toBe("#181818");
  });

  it("paints the html background so iOS Safari tints the status bar", () => {
    setStatusBarColorOverride("#7a2e2e");

    expect(document.documentElement.style.backgroundColor).toBe("#7a2e2e");
    expect(meta.content).toBe("#7a2e2e");
  });

  it("drops back to the theme colour when the override is cleared", () => {
    setStatusBarColorOverride("#7a2e2e");
    setStatusBarColorOverride(undefined);

    expect(document.documentElement.style.backgroundColor).toBe("");
    expect(meta.content).toBe("#181818");
  });

  it("keeps the override while the theme changes underneath it", () => {
    setStatusBarColorOverride("#7a2e2e");
    setStatusBarThemeColor("#f5f5f5");

    expect(meta.content).toBe("#7a2e2e");

    setStatusBarColorOverride(undefined);

    expect(meta.content).toBe("#f5f5f5");
  });
});
