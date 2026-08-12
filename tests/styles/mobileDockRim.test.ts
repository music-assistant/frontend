// jsdom leaves var() unresolved in computed styles, so this composition is only
// observable under happy-dom
// @vitest-environment happy-dom
import navSource from "@/components/navigation/BottomNavigation.vue?raw";
import footerSource from "@/layouts/default/Footer.vue?raw";
import globalCss from "@/styles/global.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const DOCK_INSET = "111px";
const RIM = "7px";
// happy-dom drops a declaration whose substituted custom property expands to a
// nested calc(), so the card is measured with its inset flattened to a literal
const PLAYER_INSET = "99px";
// the two sides carry their own values, so an assertion can only pass for the
// side it names
const DEVICE_INSET_LEFT = "22px";
const DEVICE_INSET_RIGHT = "33px";

let styles: HTMLStyleElement[];

// Use raw selectors so the test does not depend on Vue's generated scope id.
function extractStyle(source: string) {
  return source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

// happy-dom caches an element's computed style from its first read, so each
// probe is built after the custom properties it measures are in place
function probe(className: string) {
  const element = document.createElement("div");
  element.className = className;
  document.body.appendChild(element);
  return getComputedStyle(element);
}

// the declarations wrap at different points once the token names are in them,
// so compare them free of the source formatting
function normalize(value: string) {
  return value.replace(/\s+/g, "");
}

describe("mobile dock rim", () => {
  beforeEach(() => {
    styles = [
      globalCss,
      extractStyle(footerSource),
      extractStyle(navSource),
    ].map((css) => {
      const element = document.createElement("style");
      element.textContent = css;
      document.head.appendChild(element);
      return element;
    });
    // the device insets are env() values happy-dom cannot substitute, which
    // would drop every declaration that adds one; inline values beat the :root
    // definitions and stand in for them
    document.documentElement.style.setProperty(
      "--device-inset-left",
      DEVICE_INSET_LEFT,
    );
    document.documentElement.style.setProperty(
      "--device-inset-right",
      DEVICE_INSET_RIGHT,
    );
  });

  afterEach(() => {
    styles.forEach((element) => element.remove());
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  it("insets the player card by the dock's inset plus the rim", () => {
    document.documentElement.style.setProperty(
      "--mobile-dock-inset-x",
      DOCK_INSET,
    );
    document.documentElement.style.setProperty("--mobile-dock-rim", RIM);

    expect(
      normalize(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--mobile-player-inset-x",
        ),
      ),
    ).toBe(`calc(${DOCK_INSET}+${RIM})`);
  });

  it("sits the dock at its own inset", () => {
    document.documentElement.style.setProperty(
      "--mobile-dock-inset-x",
      DOCK_INSET,
    );
    const dock = probe("mobile-bottom-navigation");

    expect(normalize(dock.left)).toBe(
      `calc(${DOCK_INSET}+${DEVICE_INSET_LEFT})`,
    );
    expect(normalize(dock.right)).toBe(
      `calc(${DOCK_INSET}+${DEVICE_INSET_RIGHT})`,
    );
  });

  it("sits the player card at the card's inset, on both sides", () => {
    document.documentElement.style.setProperty(
      "--mobile-player-inset-x",
      PLAYER_INSET,
    );
    const card = probe("mediacontrols-player-float");

    expect(normalize(card.marginLeft)).toBe(
      `calc(${PLAYER_INSET}+${DEVICE_INSET_LEFT})`,
    );
    expect(normalize(card.marginRight)).toBe(
      `calc(${PLAYER_INSET}+${DEVICE_INSET_RIGHT})`,
    );
    // the width gives back both margins, so the card stays centred on the dock
    expect(normalize(card.width)).toBe(
      `calc(100%-2*${PLAYER_INSET}-${DEVICE_INSET_RIGHT}-${DEVICE_INSET_LEFT})`,
    );
  });
});
