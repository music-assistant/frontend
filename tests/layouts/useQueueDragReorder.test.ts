import { useQueueDragReorder } from "@/layouts/default/PlayerOSD/useQueueDragReorder";
import api from "@/plugins/api";
import type { PlayerQueue } from "@/plugins/api/interfaces";
import type { VirtualItem } from "@tanstack/vue-virtual";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { playerQueue } from "../fixtures/playerQueue";
import { queueItem } from "../fixtures/queueItem";

const { storeMock } = vi.hoisted(() => ({
  storeMock: { activePlayerQueue: undefined as PlayerQueue | undefined },
}));

vi.mock("@/plugins/api", () => ({
  default: { queueCommandMoveItem: vi.fn(() => Promise.resolve()) },
}));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

const ITEM_HEIGHT = 60;
// the "Up next" divider and the queue mode banner above the first up-next item
const LEAD_HEIGHT = 72;
const FIRST_UP_NEXT = 1;
const DRAGGED = 3;

// the playing item, then three up-next items, the first under the divider
const rows = [
  { index: 0, start: 0, size: ITEM_HEIGHT },
  { index: 1, start: 60, size: LEAD_HEIGHT + ITEM_HEIGHT },
  { index: 2, start: 192, size: ITEM_HEIGHT },
  { index: 3, start: 252, size: ITEM_HEIGHT },
] as VirtualItem[];
const FIRST_UP_NEXT_ITEM_TOP = rows[FIRST_UP_NEXT].start + LEAD_HEIGHT;

const mounted: { unmount: () => void }[] = [];

const onMove = vi.fn();
const onMoveFailed = vi.fn();

function setup() {
  let drag!: ReturnType<typeof useQueueDragReorder>;
  const wrapper = mount(
    defineComponent({
      setup() {
        const scrollEl = ref<HTMLElement | null>(null);
        drag = useQueueDragReorder({
          scrollEl,
          getVirtualItems: () => rows,
          itemAt: (index) => queueItem({ queue_item_id: `item-${index}` }),
          itemBoxInRow: (index) => ({
            top: index === FIRST_UP_NEXT ? LEAD_HEIGHT : 0,
            height: ITEM_HEIGHT,
          }),
          onMove,
          onMoveFailed,
        });
        return { scrollEl };
      },
      template: '<div ref="scrollEl"></div>',
    }),
    { attachTo: document.body },
  );
  mounted.push(wrapper);
  return drag;
}

const pointer = (type: string, y: number) =>
  new MouseEvent(type, { clientY: y, button: 0, bubbles: true });

/** Drags the last item and lets go with the pointer at the given height. */
function dragTo(y: number) {
  const drag = setup();
  const press = pointer("pointerdown", rows[DRAGGED].start + 10);
  Object.defineProperty(press, "pointerType", { value: "mouse" });
  drag.startItemDrag(press as PointerEvent, DRAGGED);
  window.dispatchEvent(pointer("pointermove", y));
  window.dispatchEvent(pointer("pointerup", y));
}

describe("useQueueDragReorder", () => {
  beforeEach(() => {
    vi.mocked(api.queueCommandMoveItem).mockClear();
    onMove.mockClear();
    onMoveFailed.mockClear();
    storeMock.activePlayerQueue = playerQueue({
      items: rows.length,
      current_index: 0,
      index_in_buffer: 0,
    });
  });

  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  });

  it("drops above the first up-next item from the upper half of that item", () => {
    dragTo(FIRST_UP_NEXT_ITEM_TOP + ITEM_HEIGHT / 2 - 1);

    expect(api.queueCommandMoveItem).toHaveBeenCalledWith(
      "queue-1",
      `item-${DRAGGED}`,
      FIRST_UP_NEXT - DRAGGED,
    );
  });

  it("drops below the first up-next item from the lower half of that item", () => {
    dragTo(FIRST_UP_NEXT_ITEM_TOP + ITEM_HEIGHT / 2 + 1);

    expect(api.queueCommandMoveItem).toHaveBeenCalledWith(
      "queue-1",
      `item-${DRAGGED}`,
      FIRST_UP_NEXT + 1 - DRAGGED,
    );
  });

  it("reports where a dropped item moved from and to", () => {
    dragTo(FIRST_UP_NEXT_ITEM_TOP);

    expect(onMove).toHaveBeenCalledExactlyOnceWith(DRAGGED, FIRST_UP_NEXT);
  });

  it("reports a move the server refused", async () => {
    vi.mocked(api.queueCommandMoveItem).mockRejectedValueOnce(new Error());

    dragTo(FIRST_UP_NEXT_ITEM_TOP);
    await flushPromises();

    expect(onMoveFailed).toHaveBeenCalledOnce();
  });

  it("does not report a failure for a move the server accepted", async () => {
    dragTo(FIRST_UP_NEXT_ITEM_TOP);
    await flushPromises();

    expect(onMoveFailed).not.toHaveBeenCalled();
  });

  it("reports no move for an item dropped where it was", () => {
    dragTo(rows[DRAGGED].start + 10);

    expect(onMove).not.toHaveBeenCalled();
    expect(api.queueCommandMoveItem).not.toHaveBeenCalled();
  });
});
