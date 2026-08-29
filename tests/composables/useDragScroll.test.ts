import { useDragScroll } from "@/composables/useDragScroll";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

interface Scroller {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
  setPointerCapture: (pointerId: number) => void;
}

const scroller = (overrides: Partial<Scroller> = {}) =>
  ({
    scrollLeft: 0,
    scrollWidth: 1000,
    clientWidth: 400,
    setPointerCapture: vi.fn(),
    ...overrides,
  }) as Scroller;

const down = (clientX: number, overrides: Record<string, unknown> = {}) =>
  ({
    pointerType: "mouse",
    button: 0,
    pointerId: 1,
    clientX,
    ...overrides,
  }) as unknown as PointerEvent;

const move = (clientX: number, buttons = 1) =>
  ({ pointerId: 1, clientX, buttons }) as unknown as PointerEvent;

const click = () =>
  ({
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  }) as unknown as MouseEvent & {
    stopPropagation: ReturnType<typeof vi.fn>;
    preventDefault: ReturnType<typeof vi.fn>;
  };

const setup = (el: Scroller) =>
  useDragScroll(ref(el as unknown as HTMLElement));

describe("useDragScroll", () => {
  it("leaves a small movement alone so it stays a click", () => {
    const el = scroller();
    const drag = setup(el);

    drag.onPointerDown(down(100));
    drag.onPointerMove(move(104));
    drag.onPointerUp();

    expect(drag.dragging.value).toBe(false);
    expect(el.scrollLeft).toBe(0);

    const e = click();
    drag.onClickCapture(e);
    expect(e.stopPropagation).not.toHaveBeenCalled();
  });

  it("pans the scroller once the movement passes the threshold", () => {
    const el = scroller({ scrollLeft: 50 });
    const drag = setup(el);

    drag.onPointerDown(down(100));
    drag.onPointerMove(move(80));

    expect(drag.dragging.value).toBe(true);
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    expect(el.scrollLeft).toBe(70);
  });

  it("swallows the click that ends a drag", () => {
    const el = scroller();
    const drag = setup(el);

    drag.onPointerDown(down(100));
    drag.onPointerMove(move(40));
    drag.onPointerUp();

    const e = click();
    drag.onClickCapture(e);
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it("swallows only that one click", () => {
    const el = scroller();
    const drag = setup(el);

    drag.onPointerDown(down(100));
    drag.onPointerMove(move(40));
    drag.onPointerUp();
    drag.onClickCapture(click());

    const next = click();
    drag.onClickCapture(next);
    expect(next.stopPropagation).not.toHaveBeenCalled();
  });

  it("keeps a row that has nothing to scroll clickable", () => {
    const el = scroller({ scrollWidth: 400, clientWidth: 400 });
    const drag = setup(el);

    drag.onPointerDown(down(100));
    drag.onPointerMove(move(40));
    drag.onPointerUp();

    const e = click();
    drag.onClickCapture(e);
    expect(e.stopPropagation).not.toHaveBeenCalled();
  });

  it("ends the gesture when the button was released off the scroller", () => {
    const el = scroller();
    const drag = setup(el);

    drag.onPointerDown(down(100));
    drag.onPointerMove(move(40));
    drag.onPointerMove(move(10, 0));

    expect(drag.dragging.value).toBe(false);

    // a later move with the button down again must not resume the old drag
    drag.onPointerMove(move(200));
    expect(el.scrollLeft).toBe(60);
  });

  it("ignores anything that is not a left mouse button", () => {
    const el = scroller();
    const drag = setup(el);

    drag.onPointerDown(down(100, { pointerType: "touch" }));
    drag.onPointerMove(move(40));
    expect(drag.dragging.value).toBe(false);

    drag.onPointerDown(down(100, { button: 2 }));
    drag.onPointerMove(move(40));
    expect(drag.dragging.value).toBe(false);
    expect(el.scrollLeft).toBe(0);
  });
});
