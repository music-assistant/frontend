// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import globalCss from "@/styles/global.css?inline";
import editConfigSource from "@/views/settings/EditConfig.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// happy-dom drops a declaration whose substituted custom property expands to a
// nested calc(), so the button is measured with the card's inset flattened to a
// literal
const PLAYER_INSET = "99px";

let styles: HTMLStyleElement[];
let saveButton: HTMLDivElement;

// Use raw selectors so the test does not depend on Vue's generated scope id.
function extractStyle(source: string) {
  return source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

describe("mobile floating save position", () => {
  beforeEach(() => {
    styles = [globalCss, extractStyle(editConfigSource)].map((css) => {
      const element = document.createElement("style");
      element.textContent = css;
      document.head.appendChild(element);
      return element;
    });
    // the device insets are env() values happy-dom cannot substitute, which
    // would drop every declaration that adds one; the embedded layout zeroes
    // them through the same cascade the app uses inside Home Assistant
    document.documentElement.setAttribute("data-embedded-layout", "");

    document.documentElement.style.setProperty("--bottom-bars-height", "158px");
    // Taller than the bars, so a passing test proves the fix measures the
    // bars instead of falling back to the old max-with-scrim behavior.
    document.documentElement.style.setProperty(
      "--mobile-player-scrim-height",
      "200px",
    );
    document.documentElement.style.setProperty(
      "--mobile-player-inset-x",
      PLAYER_INSET,
    );

    saveButton = document.createElement("div");
    saveButton.className = "floating-save floating-save--mobile";
    document.body.appendChild(saveButton);
  });

  afterEach(() => {
    styles.forEach((element) => element.remove());
    document.documentElement.removeAttribute("data-embedded-layout");
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  it("clears the bottom bars by 16px", () => {
    expect(getComputedStyle(saveButton).bottom.replace(/\s+/g, "")).toBe(
      "calc(158px+16px)",
    );
  });

  it("lines up with the right edge of the player card below it", () => {
    expect(getComputedStyle(saveButton).right.replace(/\s+/g, "")).toBe(
      `calc(${PLAYER_INSET}+0px)`,
    );
  });

  it("stacks above the player scrim, below the mobile bars", () => {
    expect(Number(getComputedStyle(saveButton).zIndex)).toBeGreaterThan(999);
    expect(Number(getComputedStyle(saveButton).zIndex)).toBeLessThan(2000);
  });
});
