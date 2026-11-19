import { afterEach, describe, expect, it } from "vitest";
import { isInVuetifyOverlay } from "./vuetify_overlay";

/** An outside interaction as Reka reports it, wrapping the pointer event. */
function outsideInteraction(target: Element): Event {
  const original = new Event("pointerdown");
  Object.defineProperty(original, "target", { value: target });
  return new CustomEvent("dismissableLayer.pointerDownOutside", {
    detail: { originalEvent: original },
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isInVuetifyOverlay", () => {
  it("recognises a click inside a select's menu", () => {
    document.body.innerHTML =
      '<div class="v-overlay-container"><div class="v-menu"><span id="item"></span></div></div>';

    expect(
      isInVuetifyOverlay(outsideInteraction(document.getElementById("item")!)),
    ).toBe(true);
  });

  it("leaves a click anywhere else to the dialog", () => {
    document.body.innerHTML = '<main><span id="page"></span></main>';

    expect(
      isInVuetifyOverlay(outsideInteraction(document.getElementById("page")!)),
    ).toBe(false);
  });
});
