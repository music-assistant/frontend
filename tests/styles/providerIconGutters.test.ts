// @vitest-environment happy-dom
import listviewItemSource from "@/components/ListviewItem.vue?raw";
import providerDetailsSource from "@/components/ProviderDetails.vue?raw";
import providerIconSource from "@/components/ProviderIcon.vue?raw";
import utilities from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectorsSetting, styleBlocks } from "./cascade";

let styles: HTMLStyleElement[];

function providerIcon(className = "") {
  const icon = document.createElement("div");
  icon.className = `provider-icon-wrapper ${className}`;
  document.body.appendChild(icon);
  return icon;
}

describe("provider icon gutters", () => {
  beforeEach(() => {
    styles = [utilities, ...styleBlocks(providerIconSource)].map((text) => {
      const element = document.createElement("style");
      element.textContent = text;
      document.head.appendChild(element);
      return element;
    });
  });

  afterEach(() => {
    styles.forEach((element) => element.remove());
    document.body.innerHTML = "";
  });

  it("has no side gutters by default", () => {
    const icon = providerIcon();

    expect(selectorsSetting(styles[1], icon, "margin")).toHaveLength(0);
    expect(selectorsSetting(styles[1], icon, "margin-left")).toHaveLength(0);
    expect(selectorsSetting(styles[1], icon, "margin-right")).toHaveLength(0);
  });

  it("keeps the list call sites explicitly spaced", () => {
    expect(listviewItemSource).toContain('class="mx-[10px]"');
    expect(providerDetailsSource.match(/class="mx-\[10px\]"/g)).toHaveLength(2);

    const icon = providerIcon("mx-[10px]");
    expect(selectorsSetting(styles[0], icon, "margin-inline")).toHaveLength(1);
  });
});
