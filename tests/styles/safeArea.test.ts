import appIndex from "../../index.html?raw";
import publicIndex from "../../public/index.html?raw";
import css from "@/styles/global.css?inline";
import { afterEach, describe, expect, it } from "vitest";

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

describe("embedded safe area", () => {
  const insetProperties = ["top", "right", "bottom", "left"].map(
    (side) => `--device-inset-${side}`,
  );

  afterEach(() => {
    document.head.querySelector("[data-safe-area-test]")?.remove();
    document.documentElement.removeAttribute("data-embedded-layout");
  });

  it("leaves device insets to the embedding host", () => {
    const styles = document.createElement("style");
    styles.dataset.safeAreaTest = "";
    styles.textContent = css;
    document.head.appendChild(styles);
    document.documentElement.setAttribute("data-embedded-layout", "");

    const computed = getComputedStyle(document.documentElement);
    for (const property of insetProperties) {
      expect(computed.getPropertyValue(property).trim()).toBe("0px");
    }
  });
});
