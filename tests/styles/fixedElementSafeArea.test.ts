// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import { buttonVariants } from "@/components/ui/button";
import dialogContentSource from "@/components/ui/dialog/DialogContent.vue?raw";
import footerSource from "@/layouts/default/Footer.vue?raw";
import reloadPromptSource from "@/layouts/default/ReloadPrompt.vue?raw";
import playerTrackMenuSource from "@/layouts/default/PlayerOSD/PlayerControlBtn/PlayerTrackMenu.vue?raw";
import { cn } from "@/lib/utils";
import utilities from "@/styles/style.css?inline";
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

// A scoped block arrives here without the [data-v-hash] compound the compiler
// pairs each of its selectors with, so it is a rank short of what ships. The
// utilities load first below to stand in for the tie that rank settles.
function extractStyle(source: string) {
  return source.match(/<style(?: scoped)?>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

// Read off the template rather than copied, so a class the rules key on going
// missing fails here instead of leaving the probe measuring rules the element
// no longer carries.
function templateClasses(source: string, pattern: RegExp) {
  const classes = source.match(pattern)?.[1];
  if (!classes)
    throw new Error(`the template carries no class list for ${pattern}`);
  return classes;
}

// DialogContent composes its own list in the template, so the dialog is probed
// the way it is rendered: the !important max-width in there is exactly what the
// dialog's own placement has to beat.
function dialogContentClasses(className: string) {
  const base = dialogContentSource.match(/cn\(\s*'([^']*)'/)?.[1];
  if (!base) throw new Error("DialogContent no longer composes a base list");
  return cn(base, className);
}

const PLAYBACK_SPEED_DIALOG = dialogContentClasses(
  templateClasses(
    playerTrackMenuSource,
    /<DialogContent[\s\S]*?\sclass="([^"]*)"/,
  ),
);
// a Button merges the classes it is passed onto its own, and its variants are
// where the competing radius comes from
const EDIT_DONE = cn(
  buttonVariants(),
  templateClasses(
    homeViewSource,
    /<Button[^>]*\sclass="([^"]*\bed-edit-done\b[^"]*)"/,
  ),
);

// happy-dom substitutes var() but never evaluates calc(), so a sum is only
// observable as the expression composing it
function normalize(value: string) {
  return value.replace(/\s+/g, "");
}

const appStyles: HTMLStyleElement[] = [];
let utilityStyles: HTMLStyleElement;

// an override proves nothing unless the ui component's own utilities really do
// set the property, and set it !important
function expectUtilitiesCompete(element: Element, property: string) {
  const priorities = [...(utilityStyles.sheet?.cssRules ?? [])]
    .filter((rule) => rule instanceof CSSStyleRule)
    .filter(
      (rule) =>
        element.matches(rule.selectorText) &&
        rule.style.getPropertyValue(property) !== "",
    )
    .map((rule) => rule.style.getPropertyPriority(property));

  expect(
    priorities,
    `the component the element is built from must keep setting ${property}`,
  ).not.toHaveLength(0);
  expect(
    [...new Set(priorities)],
    "the Tailwind utilities import must stay `important` and unlayered",
  ).toEqual(["important"]);
}

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
  // first, so a rule the components declare still wins the ties their shipped
  // selectors win on rank alone
  utilityStyles = document.createElement("style");
  utilityStyles.textContent = utilities;
  document.head.appendChild(utilityStyles);
  appStyles.push(utilityStyles);

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
  ["home screen edit button", homeViewSource, EDIT_DONE, "24px"],
  // The dialog writes its gap as 1rem, which resolves to the root font size.
  [
    "playback speed dialog",
    playerTrackMenuSource,
    PLAYBACK_SPEED_DIALOG,
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
    const element = render(homeViewSource, EDIT_DONE);

    expect(normalize(getComputedStyle(element).top)).toBe(
      `calc(24px+${INSET_TOP})`,
    );
  });

  // It floats over the widgets rather than sitting in a row of controls, so it
  // is shaped to read as its own thing instead of as one more button.
  it("keeps its pill shape against the corners every button gets", () => {
    const element = render(homeViewSource, EDIT_DONE);

    // happy-dom keeps no declaration for the border-radius shorthand the
    // variants carry, so the competition is only observable in the value: a
    // pill that loses reads as the radius token every other button takes
    expect(getComputedStyle(element).borderRadius).toBe("999px");
  });
});

describe("playback speed dialog", () => {
  // Offsetting only the near edge would push the far one off screen once the
  // dialog is wide enough to be clamped.
  it("clamps its width to both safe edges", () => {
    const element = render(playerTrackMenuSource, PLAYBACK_SPEED_DIALOG);

    expectUtilitiesCompete(element, "max-width");
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
