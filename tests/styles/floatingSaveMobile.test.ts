// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import editConfigSource from "@/views/settings/EditConfig.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let appStyles: HTMLStyleElement;
let saveButton: HTMLDivElement;

// Use raw selectors so the test does not depend on Vue's generated scope id.
function extractStyle(source: string) {
  return source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

describe("mobile floating save position", () => {
  beforeEach(() => {
    appStyles = document.createElement("style");
    appStyles.textContent = extractStyle(editConfigSource);
    document.head.appendChild(appStyles);

    document.documentElement.style.setProperty("--bottom-bars-height", "158px");
    // Taller than the bars, so a passing test proves the fix measures the
    // bars instead of falling back to the old max-with-scrim behavior.
    document.documentElement.style.setProperty(
      "--mobile-player-scrim-height",
      "200px",
    );

    saveButton = document.createElement("div");
    saveButton.className = "floating-save floating-save--mobile";
    document.body.appendChild(saveButton);
  });

  afterEach(() => {
    appStyles.remove();
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("--bottom-bars-height");
    document.documentElement.style.removeProperty(
      "--mobile-player-scrim-height",
    );
  });

  it("clears the bottom bars by 16px", () => {
    expect(getComputedStyle(saveButton).bottom.replace(/\s+/g, "")).toBe(
      "calc(158px+16px)",
    );
  });

  it("stacks above the player scrim, below the mobile bars", () => {
    expect(Number(getComputedStyle(saveButton).zIndex)).toBeGreaterThan(999);
    expect(Number(getComputedStyle(saveButton).zIndex)).toBeLessThan(2000);
  });
});
