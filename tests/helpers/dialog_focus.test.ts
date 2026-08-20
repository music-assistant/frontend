import {
  focusCommandInputOnOpen,
  preventOnScreenKeyboardOnOpen,
} from "@/helpers/dialog_focus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", () => ({ store: { isTouchscreen: false } }));

const { store } = await import("@/plugins/store");

/** A dialog layer holding a command palette's search field. */
function paletteLayer(withInput = true) {
  const layer = document.createElement("div");
  layer.setAttribute("data-dismissable-layer", "");
  layer.tabIndex = -1;
  if (withInput) {
    const input = document.createElement("input");
    input.setAttribute("data-slot", "command-input");
    layer.appendChild(input);
  }
  document.body.appendChild(layer);
  return layer;
}

/** The event reka-ui hands an `@open-auto-focus` handler. */
function openAutoFocusEvent(target: HTMLElement) {
  const event = new Event("openAutoFocus", { cancelable: true });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
  store.isTouchscreen = false;
});

describe("focusCommandInputOnOpen", () => {
  it("puts the caret in the search field instead of the layer", () => {
    const layer = paletteLayer();
    const event = openAutoFocusEvent(layer);

    focusCommandInputOnOpen(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      layer.querySelector('[data-slot="command-input"]'),
    );
  });

  // raising the keyboard is the whole point of a search dialog, so this one
  // deliberately does not stand down where preventOnScreenKeyboardOnOpen does
  it("still focuses the field on a touch device", () => {
    store.isTouchscreen = true;
    const layer = paletteLayer();

    focusCommandInputOnOpen(openAutoFocusEvent(layer));

    expect(document.activeElement).toBe(
      layer.querySelector('[data-slot="command-input"]'),
    );
  });

  it("leaves the default focus alone when there is no field", () => {
    const event = openAutoFocusEvent(paletteLayer(false));

    focusCommandInputOnOpen(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

describe("preventOnScreenKeyboardOnOpen", () => {
  it("keeps focus off the field on a touch device", () => {
    store.isTouchscreen = true;
    const layer = paletteLayer();

    const event = openAutoFocusEvent(layer);
    preventOnScreenKeyboardOnOpen(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(layer);
  });

  it("leaves a device without a touchscreen to the default", () => {
    const layer = paletteLayer();

    const event = openAutoFocusEvent(layer);
    preventOnScreenKeyboardOnOpen(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
