import AutoplayRepeatLockButton from "@/layouts/default/PlayerOSD/AutoplayRepeatLockButton.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

enableAutoUnmount(afterEach);

const DESCRIPTION =
  "Autoplay has been automatically turned off because repeat is on";

// The component carries its own TooltipProvider, so it mounts standalone. The
// tooltip content portals to document.body, so assertions query the document.
function mountButton() {
  return mount(AutoplayRepeatLockButton, {
    props: { description: DESCRIPTION },
    slots: { default: "<span>icon</span>" },
    attrs: { "aria-label": "Autoplay", role: "switch" },
    attachTo: document.body,
  });
}

function tooltipContent(): Element | null {
  return document.querySelector('[data-slot="tooltip-content"]');
}

describe("AutoplayRepeatLockButton", () => {
  it("associates the explanation with the trigger for screen readers", () => {
    const button = mountButton().get("button");

    const describedBy = button.attributes("aria-describedby");
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(describedBy!);
    expect(description?.textContent).toBe(DESCRIPTION);

    // the wiring the parents rely on falls through onto the trigger
    expect(button.attributes("aria-label")).toBe("Autoplay");
    expect(button.attributes("role")).toBe("switch");
  });

  it("opens the explanation on click (tap)", async () => {
    const wrapper = mountButton();
    expect(tooltipContent()).toBeNull();

    await wrapper.get("button").trigger("click");
    await nextTick();

    expect(tooltipContent()?.textContent).toContain(DESCRIPTION);
  });

  it("opens the explanation on keyboard focus", async () => {
    const wrapper = mountButton();

    await wrapper.get("button").trigger("focus");
    await nextTick();

    expect(tooltipContent()?.textContent).toContain(DESCRIPTION);
  });
});
