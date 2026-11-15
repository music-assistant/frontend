import { useListDragReorder } from "@/composables/useListDragReorder";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";

const ROW_HEIGHT = 50;
const mounted: { unmount: () => void }[] = [];

function setup(commitsInPlace?: (source: number) => boolean) {
  const onCommit = vi.fn();
  let drag!: ReturnType<typeof useListDragReorder>;
  const wrapper = mount(
    defineComponent({
      setup() {
        const listEl = ref<HTMLElement | null>(null);
        drag = useListDragReorder({
          listEl,
          count: () => 3,
          onCommit,
          commitsInPlace,
          rowBox: (index) =>
            index >= 0 && index < 3
              ? { top: index * ROW_HEIGHT, height: ROW_HEIGHT }
              : undefined,
        });
        return { listEl };
      },
      template: '<div ref="listEl"><button id="row">row</button></div>',
    }),
    { attachTo: document.body },
  );
  mounted.push(wrapper);
  return { drag, onCommit, row: wrapper.find("#row").element as HTMLElement };
}

const pointer = (type: string, x: number, y: number) =>
  new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });

function press(
  drag: ReturnType<typeof useListDragReorder>,
  x: number,
  y: number,
) {
  const evt = pointer("pointerdown", x, y) as PointerEvent;
  Object.defineProperty(evt, "pointerType", { value: "mouse" });
  drag.startItemDrag(evt, 0);
}

describe("useListDragReorder", () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  });

  it("commits a drag back to its start for a row that commits in place", () => {
    const { drag, onCommit } = setup(() => true);

    press(drag, 10, 10);
    window.dispatchEvent(pointer("pointermove", 60, 12));
    window.dispatchEvent(pointer("pointerup", 60, 12));

    expect(onCommit).toHaveBeenCalledWith(0, 0);
  });

  it("does not commit a press that never moved", () => {
    const { drag, onCommit } = setup(() => true);

    press(drag, 10, 10);
    window.dispatchEvent(pointer("pointerup", 11, 10));

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("swallows the click that ends a drag which moved", () => {
    const { drag, row } = setup();
    const onClick = vi.fn();
    row.addEventListener("click", onClick);

    press(drag, 10, 10);
    window.dispatchEvent(pointer("pointermove", 60, 12));
    window.dispatchEvent(pointer("pointerup", 60, 12));
    row.click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it("lets a press that did not move click as usual", () => {
    const { drag, row } = setup();
    const onClick = vi.fn();
    row.addEventListener("click", onClick);

    press(drag, 10, 10);
    window.dispatchEvent(pointer("pointerup", 11, 10));
    row.click();

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not swallow a later click", async () => {
    const { drag, row } = setup();
    const onClick = vi.fn();
    row.addEventListener("click", onClick);

    press(drag, 10, 10);
    window.dispatchEvent(pointer("pointermove", 60, 12));
    window.dispatchEvent(pointer("pointerup", 60, 12));
    await new Promise((resolve) => setTimeout(resolve));
    row.click();

    expect(onClick).toHaveBeenCalledOnce();
  });
});
