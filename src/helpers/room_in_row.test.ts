import { afterEach, describe, expect, it } from "vitest";
import { roomInRow } from "./room_in_row";

/** A child of the given width; jsdom does no layout, so widths are set here. */
function child(width: number): HTMLElement {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ width }) as DOMRect;
  return element;
}

function row(width: number, style: Partial<CSSStyleDeclaration> = {}) {
  const element = document.createElement("div");
  Object.assign(element.style, style);
  Object.defineProperty(element, "clientWidth", { value: width });
  document.body.appendChild(element);
  return element;
}

describe("roomInRow", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("leaves the row's width less the other items and their gaps", () => {
    const parent = row(375, { columnGap: "10px" });
    const target = child(0);
    parent.append(target, child(44), child(44));

    expect(roomInRow(target)).toBe(375 - 44 - 44 - 2 * 10);
  });

  it("leaves out the row's padding", () => {
    const parent = row(300, { paddingLeft: "16px", paddingRight: "16px" });
    const target = child(0);
    parent.append(target, child(40));

    expect(roomInRow(target)).toBe(300 - 32 - 40);
  });

  it("gives an item that isn't shown neither width nor a gap", () => {
    const parent = row(300, { columnGap: "8px" });
    const target = child(0);
    parent.append(target, child(40), child(0));

    expect(roomInRow(target)).toBe(300 - 40 - 8);
  });

  it("has no limit outside a row", () => {
    expect(roomInRow(child(0))).toBe(Infinity);
  });
});
