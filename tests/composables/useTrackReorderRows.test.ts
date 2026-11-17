import { useTrackReorderRows } from "@/composables/useTrackReorderRows";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { track } from "../fixtures/track";

const { draggingIndex } = vi.hoisted(() => ({
  draggingIndex: { value: null as number | null },
}));

vi.mock("@/composables/usePlaylistTrackReorder", () => ({
  usePlaylistTrackReorder: () => ({
    draggingIndex,
    isDragging: { value: false },
    rowOffset: () => 0,
    saving: ref(false),
  }),
}));

const rows: MediaItemType[] = [
  track({ item_id: "1" }),
  track({ item_id: "2" }),
  track({ item_id: "3" }),
];

const mounted: { unmount: () => void }[] = [];

/** The drag class of every row while the row at `dragged` is dragged. */
function rowClasses(dragged: number, selected: number[], selecting = true) {
  let reorder!: ReturnType<typeof useTrackReorderRows>;
  mounted.push(
    mount(
      defineComponent({
        setup() {
          reorder = useTrackReorderRows({
            listEl: ref(null),
            items: ref(rows),
            playlistId: () => "1",
            inOwnOrder: () => true,
            selected: ref(selected.map((index) => rows[index])),
            selecting: () => selecting,
            rowHeight: 48,
            reload: () => Promise.resolve(),
          });
          return {};
        },
        template: "<div></div>",
      }),
    ),
  );
  draggingIndex.value = dragged;
  return rows.map((row, index) => reorder.rowDragClass(row, index));
}

describe("useTrackReorderRows", () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    draggingIndex.value = null;
  });

  it("hides every selected row while one of them is dragged", () => {
    expect(rowClasses(0, [0, 2])).toEqual([
      "invisible",
      undefined,
      "invisible",
    ]);
  });

  it("hides only the dragged row when it is not part of the selection", () => {
    expect(rowClasses(1, [0, 2])).toEqual([undefined, "invisible", undefined]);
  });

  it("hides only the dragged row when the rows cannot be selected", () => {
    expect(rowClasses(0, [0, 2], false)).toEqual([
      "invisible",
      undefined,
      undefined,
    ]);
  });
});
