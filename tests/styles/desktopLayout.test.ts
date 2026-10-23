// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import viewSource from "@/layouts/default/View.vue?raw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const FOOTER_HEIGHT = "104px";
const DEVICE_INSET = "24px";

let appStyles: HTMLStyleElement;

function extractStyle(source: string) {
  return source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

function normalize(value: string) {
  return value.replace(/\s+/g, "");
}

function layout(...modifiers: string[]) {
  const element = document.createElement("main");
  element.className = ["main-layout", ...modifiers].join(" ");
  document.body.appendChild(element);
  return getComputedStyle(element);
}

describe("desktop app shell", () => {
  beforeEach(() => {
    appStyles = document.createElement("style");
    appStyles.textContent = extractStyle(viewSource);
    document.head.appendChild(appStyles);
    document.documentElement.style.setProperty(
      "--v-layout-bottom",
      FOOTER_HEIGHT,
    );
    document.documentElement.style.setProperty(
      "--device-inset-bottom",
      DEVICE_INSET,
    );
  });

  afterEach(() => {
    appStyles.remove();
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
  });

  it("reserves the measured footer and safe area outside the scroller", () => {
    expect(normalize(layout().paddingBottom)).toBe(
      `calc(${FOOTER_HEIGHT}+${DEVICE_INSET})`,
    );
  });

  it.each(["main-layout--mobile", "main-layout--frameless"])(
    "keeps %s full height",
    (modifier) => {
      expect(layout(modifier).paddingBottom).toBe("0px");
    },
  );
});
