// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import editConfigSource from "@/views/settings/EditConfig.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// happy-dom drops a declaration whose substituted custom property expands to a
// nested calc(), so the card's inset is read as a literal. The device inset
// carries its own value so neither term can stand in for the other.
const PLAYER_INSET = "99px";
const DEVICE_INSET_RIGHT = "33px";

let appStyles: HTMLStyleElement;
let saveButton: HTMLDivElement;

// Use raw selectors so the test does not depend on Vue's generated scope id.
function extractStyle(source: string) {
  return source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

// the declarations wrap at different points once the token names are in them,
// so compare them free of the source formatting
function normalize(value: string) {
  return value.replace(/\s+/g, "");
}

describe("mobile floating save position", () => {
  beforeEach(() => {
    appStyles = document.createElement("style");
    appStyles.textContent = extractStyle(editConfigSource);
    document.head.appendChild(appStyles);

    document.documentElement.style.setProperty("--bottom-bars-height", "158px");
    // Taller than the bars, so the button only clears them by 16px if it is
    // measured from the bars rather than the scrim.
    document.documentElement.style.setProperty(
      "--mobile-player-scrim-height",
      "200px",
    );
    document.documentElement.style.setProperty(
      "--mobile-player-inset-x",
      PLAYER_INSET,
    );
    document.documentElement.style.setProperty(
      "--device-inset-right",
      DEVICE_INSET_RIGHT,
    );

    saveButton = document.createElement("div");
    saveButton.className = "floating-save floating-save--mobile";
    document.body.appendChild(saveButton);
  });

  afterEach(() => {
    appStyles.remove();
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  it("clears the bottom bars by 16px", () => {
    expect(normalize(getComputedStyle(saveButton).bottom)).toBe(
      "calc(158px+16px)",
    );
  });

  it("lines up with the right edge of the player card below it", () => {
    expect(normalize(getComputedStyle(saveButton).right)).toBe(
      `calc(${PLAYER_INSET}+${DEVICE_INSET_RIGHT})`,
    );
  });

  it("stacks above the player scrim, below the mobile bars", () => {
    expect(Number(getComputedStyle(saveButton).zIndex)).toBeGreaterThan(999);
    expect(Number(getComputedStyle(saveButton).zIndex)).toBeLessThan(2000);
  });
});
