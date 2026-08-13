// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import footerSource from "@/layouts/default/Footer.vue?raw";
import reloadPromptSource from "@/layouts/default/ReloadPrompt.vue?raw";
import playerTrackMenuSource from "@/layouts/default/PlayerOSD/PlayerControlBtn/PlayerTrackMenu.vue?raw";
import homeViewSource from "@/views/HomeView.vue?raw";
import editConfigSource from "@/views/settings/EditConfig.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Every inset carries a distinct value, so an element reaching for the wrong
// side reads as the wrong number instead of quietly passing.
const INSET_RIGHT = "33px";
const INSET_LEFT = "77px";
const INSET_TOP = "55px";
const INSET_BOTTOM = "11px";
// Taller than the bottom inset it already folds in, so an element measuring
// from the wrong one cannot read as the right number.
const BARS_HEIGHT = "158px";

// Use raw selectors so the tests do not depend on Vue's generated scope id.
function extractStyle(source: string) {
  return source.match(/<style(?: scoped)?>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

// happy-dom substitutes var() but never evaluates calc(), so a sum is only
// observable as the expression composing it
function normalize(value: string) {
  return value.replace(/\s+/g, "");
}

const appStyles: HTMLStyleElement[] = [];

function render(source: string, className: string) {
  const styles = document.createElement("style");
  styles.textContent = extractStyle(source);
  document.head.appendChild(styles);
  appStyles.push(styles);

  const element = document.createElement("div");
  element.className = className;
  document.body.appendChild(element);
  return element;
}

beforeEach(() => {
  document.documentElement.style.setProperty("--device-inset-top", INSET_TOP);
  document.documentElement.style.setProperty(
    "--device-inset-right",
    INSET_RIGHT,
  );
  document.documentElement.style.setProperty(
    "--device-inset-bottom",
    INSET_BOTTOM,
  );
  document.documentElement.style.setProperty("--device-inset-left", INSET_LEFT);
  document.documentElement.style.setProperty(
    "--bottom-bars-height",
    BARS_HEIGHT,
  );
});

afterEach(() => {
  appStyles.splice(0).forEach((styles) => styles.remove());
  document.documentElement.removeAttribute("style");
  document.body.innerHTML = "";
});

describe.each([
  // The desktop rule is what a landscape phone gets, so it carries the inset
  // even though the mobile variant has its own.
  ["settings save button", editConfigSource, "floating-save", "24px"],
  ["home screen edit button", homeViewSource, "ed-edit-done", "24px"],
  // The dialog writes its gap as 1rem, which resolves to the root font size.
  [
    "playback speed dialog",
    playerTrackMenuSource,
    "playback-speed-dialog",
    "16px",
  ],
])("%s", (_name, source, className, gap) => {
  it("keeps its gap clear of a side cutout", () => {
    const element = render(source, className);

    expect(normalize(getComputedStyle(element).right)).toBe(
      `calc(${gap}+${INSET_RIGHT})`,
    );
  });
});

describe("home screen edit button", () => {
  it("clears the notch it sits under in portrait", () => {
    const element = render(homeViewSource, "ed-edit-done");

    expect(normalize(getComputedStyle(element).top)).toBe(
      `calc(24px+${INSET_TOP})`,
    );
  });
});

describe("playback speed dialog", () => {
  // Offsetting only the near edge would push the far one off screen once the
  // dialog is wide enough to be clamped.
  it("clamps its width to both safe edges", () => {
    const element = render(playerTrackMenuSource, "playback-speed-dialog");

    // happy-dom resolves 100vw and 2rem before handing the expression back.
    expect(normalize(getComputedStyle(element).maxWidth)).toBe(
      `calc(${window.innerWidth}px-32px-${INSET_LEFT}-${INSET_RIGHT})`,
    );
  });
});

describe("update toast", () => {
  it("sits its margin clear of a side cutout", () => {
    const element = render(reloadPromptSource, "pwa-toast");

    // The margin sets the gap, so the offset is the inset on its own.
    expect(normalize(getComputedStyle(element).right)).toBe(INSET_RIGHT);
    expect(normalize(getComputedStyle(element).marginRight)).toBe("16px");
  });

  it("sits its margin clear of the bars pinned to the bottom", () => {
    const element = render(reloadPromptSource, "pwa-toast");

    // Those rest on the bottom edge, so clearing them clears its inset too.
    expect(normalize(getComputedStyle(element).bottom)).toBe(BARS_HEIGHT);
    expect(normalize(getComputedStyle(element).marginBottom)).toBe("16px");
  });

  it("clears only the bottom edge without the app frame", () => {
    const element = render(
      reloadPromptSource,
      "pwa-toast pwa-toast--frameless",
    );

    expect(normalize(getComputedStyle(element).bottom)).toBe(INSET_BOTTOM);
  });

  it("paints above the player bar it floats over", () => {
    const element = render(reloadPromptSource, "pwa-toast");
    // It renders outside v-app, which is no stacking context, so the two
    // compete directly.
    const playerBar = render(
      footerSource,
      "v-footer mediacontrols-player-float",
    );

    expect(Number(getComputedStyle(element).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(playerBar).zIndex),
    );
    // Anything that blocks the screen on purpose still covers it, starting
    // with the settings loading overlays.
    expect(Number(getComputedStyle(element).zIndex)).toBeLessThan(2100);
  });
});
