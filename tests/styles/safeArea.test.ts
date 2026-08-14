import appIndex from "../../index.html?raw";
import publicIndex from "../../public/index.html?raw";
import css from "@/styles/global.css?inline";
import { afterEach, describe, expect, it } from "vitest";

// happy-dom substitutes every var() but does not evaluate calc() or max(), so
// the insets are only observable as the expression they compose
function applyGlobalStyles() {
  const styles = document.createElement("style");
  styles.dataset.safeAreaTest = "";
  styles.textContent = css;
  document.head.appendChild(styles);
}

afterEach(() => {
  document.head.querySelector("[data-safe-area-test]")?.remove();
  document.documentElement.removeAttribute("data-embedded-layout");
  document.documentElement.style.removeProperty("--device-inset-bottom");
});

describe.each([
  ["development", appIndex],
  ["bundled", publicIndex],
])("%s viewport", (_name, html) => {
  it("exposes the device safe-area insets", () => {
    expect(html).toContain(
      'content="width=device-width,initial-scale=1.0,viewport-fit=cover"',
    );
  });
});

describe("bottom navigation", () => {
  it("takes its clearance from the device inset rather than adding to it", () => {
    applyGlobalStyles();

    expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--mobile-navigation-inset-bottom")
        .replace(/\s+/g, " ")
        .trim(),
    ).toBe("max( 12px, calc(env(safe-area-inset-bottom, 0px) * 0.65) )");
  });
});

describe("embedded safe area", () => {
  const insetProperties = ["top", "right", "bottom", "left"].map(
    (side) => `--device-inset-${side}`,
  );

  it("leaves device insets to the embedding host", () => {
    applyGlobalStyles();
    document.documentElement.setAttribute("data-embedded-layout", "");

    const computed = getComputedStyle(document.documentElement);
    for (const property of insetProperties) {
      expect(computed.getPropertyValue(property).trim()).toBe("0px");
    }
  });

  it("takes the insets an embedding host reports over the zeroed tokens", () => {
    applyGlobalStyles();
    document.documentElement.setAttribute("data-embedded-layout", "");
    document.documentElement.style.setProperty("--device-inset-bottom", "34px");

    expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--device-inset-bottom")
        .trim(),
    ).toBe("34px");
  });
});
