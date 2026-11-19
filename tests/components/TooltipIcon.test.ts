import TooltipIcon from "@/components/TooltipIcon.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

enableAutoUnmount(afterEach);

const label = "Includes plays linked to library tracks.";

function mountIcon() {
  return mount(TooltipIcon, {
    attachTo: document.body,
    props: { label },
    slots: { default: '<svg aria-hidden="true"></svg>' },
  });
}

const popover = () => document.querySelector('[data-slot="popover-content"]');

describe("TooltipIcon", () => {
  it("is a labelled button", () => {
    const button = mountIcon().get("button");

    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("aria-label")).toBe(label);
  });

  it("toggles the explanation on click or tap", async () => {
    const button = mountIcon().get("button");

    await button.trigger("click");
    await flushPromises();
    expect(popover()?.textContent?.trim()).toBe(label);
    expect(button.attributes("aria-expanded")).toBe("true");

    await button.trigger("click");
    await flushPromises();
    expect(button.attributes("aria-expanded")).toBe("false");
  });

  it("closes on Escape", async () => {
    const button = mountIcon().get("button");
    await button.trigger("click");
    await flushPromises();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();

    expect(button.attributes("aria-expanded")).toBe("false");
  });
});
