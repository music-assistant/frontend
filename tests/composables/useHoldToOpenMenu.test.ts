import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import { describe, expect, it, vi } from "vitest";

const touchEvent = (x: number, y: number): Event =>
  ({
    touches: [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as Event;

const mouseEvent = (x: number, y: number): Event =>
  ({
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as Event;

describe("getEventPosition", () => {
  it("reads clientX/clientY from mouse and pointer events", () => {
    expect(getEventPosition(mouseEvent(10, 20))).toEqual({ x: 10, y: 20 });
  });

  it("reads coordinates from the first touch of a touch event", () => {
    expect(getEventPosition(touchEvent(30, 40))).toEqual({ x: 30, y: 40 });
  });

  it("falls back to changedTouches when touches is empty (touchend)", () => {
    const evt = {
      touches: [],
      changedTouches: [{ clientX: 5, clientY: 6 }],
    } as unknown as Event;
    expect(getEventPosition(evt)).toEqual({ x: 5, y: 6 });
  });

  it("returns 0,0 when no coordinates are available", () => {
    expect(
      getEventPosition({ touches: [], changedTouches: [] } as unknown as Event),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("useHoldToOpenMenu", () => {
  it("opens the menu on hold, forwarding the event and extra args", () => {
    const openMenu = vi.fn();
    const { onHold } = useHoldToOpenMenu(openMenu);
    const evt = touchEvent(1, 2);
    onHold(evt, 42);
    expect(openMenu).toHaveBeenCalledWith(evt, 42);
  });

  it("swallows exactly one click after a hold", () => {
    const { onHold, swallowClickAfterHold } = useHoldToOpenMenu(vi.fn());
    onHold(touchEvent(1, 2));

    const click = mouseEvent(1, 2);
    expect(swallowClickAfterHold(click)).toBe(true);
    expect(click.preventDefault).toHaveBeenCalled();
    expect(click.stopPropagation).toHaveBeenCalled();

    expect(swallowClickAfterHold(mouseEvent(1, 2))).toBe(false);
  });

  it("does not swallow clicks without a preceding hold", () => {
    const { swallowClickAfterHold } = useHoldToOpenMenu(vi.fn());
    const click = mouseEvent(1, 2);
    expect(swallowClickAfterHold(click)).toBe(false);
    expect(click.preventDefault).not.toHaveBeenCalled();
  });

  it("resets the hold flag on the next touchstart", () => {
    const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(
      vi.fn(),
    );
    onHold(touchEvent(1, 2));
    onTouchStart();
    expect(swallowClickAfterHold(mouseEvent(1, 2))).toBe(false);
  });
});
