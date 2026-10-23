import {
  isPlaylistMoveSaving,
  sendPlaylistMove,
  usePlaylistTrackReorder,
} from "@/composables/usePlaylistTrackReorder";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref, toRaw } from "vue";
import { track } from "../fixtures/track";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    movePlaylistTrack: vi.fn<() => Promise<void>>(),
    movePlaylistTracks: vi.fn<() => Promise<void>>(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
  ConnectionState: { INITIALIZED: "initialized" },
}));

const pointer = (type: string, y: number) =>
  new MouseEvent(type, { clientX: 10, clientY: y, button: 0, bubbles: true });

/** Grabs the first row and drags it down onto the third. */
function dragFirstRowToThird(
  reorder: ReturnType<typeof usePlaylistTrackReorder>,
) {
  const press = pointer("pointerdown", 10) as PointerEvent;
  Object.defineProperty(press, "pointerType", { value: "mouse" });
  reorder.startDrag(press, 0);
  window.dispatchEvent(pointer("pointermove", 140));
}

const listing = (...ids: string[]): MediaItemType[] =>
  ids.map((id, index) => track({ item_id: id, position: index + 1 }));

const mounted: { unmount: () => void }[] = [];

function setup(ids: string[], selectedIndices: number[]) {
  const items = ref<MediaItemType[]>(listing(...ids));
  // the listing hands out reactive rows, as a selection holds them
  const selection = ref<MediaItemType[]>(
    selectedIndices.map((index) => items.value[index]),
  );
  const reload = vi.fn(async () => {});
  let reorder!: ReturnType<typeof usePlaylistTrackReorder>;
  const wrapper = mount(
    defineComponent({
      setup() {
        reorder = usePlaylistTrackReorder({
          listEl: ref(listEl),
          items,
          playlistId: () => "1",
          inOwnOrder: () => true,
          selectedIndices: () => selectedIndices,
          rowHeight: 56,
          reload,
          onRowsReplaced: (replacement) => {
            selection.value = selection.value.flatMap((item) => {
              const row = replacement(item);
              return row ? [row] : [];
            });
          },
        });
        return () => null;
      },
    }),
  );
  mounted.push(wrapper);
  return { items, selection, reload, reorder };
}

const ids = (items: MediaItemType[]) => items.map((item) => item.item_id);
const positions = (items: MediaItemType[]) =>
  items.map((item) => ("position" in item ? item.position : undefined));

describe("usePlaylistTrackReorder", () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.clearAllMocks();
    apiMock.state.value = "initialized";
  });

  it("leaves the rows alone while the server is out of reach", async () => {
    apiMock.state.value = "reconnecting";
    const { items, reload, reorder } = setup(["A", "B", "C"]);

    await reorder.move(0, 2);

    expect(ids(items.value)).toEqual(["A", "B", "C"]);
    expect(apiMock.movePlaylistTrack).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps the moved tracks selected, with their new positions", async () => {
    let finishSave = () => {};
    apiMock.movePlaylistTracks.mockImplementation(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const { items, selection, reload, reorder } = setup(
      ["A", "B", "C", "D"],
      [1, 3],
    );
    reload.mockImplementation(async () => {
      items.value = listing("B", "D", "A", "C");
    });

    const move = reorder.moveRows([1, 3], 0);
    await flushPromises();

    expect(ids(selection.value)).toEqual(["B", "D"]);
    expect(positions(selection.value)).toEqual([1, 2]);

    finishSave();
    await move;

    expect(ids(selection.value)).toEqual(["B", "D"]);
    // the selection holds the reloaded rows themselves, not copies of them
    expect(toRaw(selection.value[0])).toBe(toRaw(items.value[0]));
    expect(toRaw(selection.value[1])).toBe(toRaw(items.value[1]));
  });

  it("reads the order back and clears the selection when the move fails", async () => {
    apiMock.movePlaylistTracks.mockRejectedValue(new Error("failed"));
    const { items, selection, reload, reorder } = setup(
      ["A", "B", "C", "D"],
      [1, 3],
    );

    await reorder.moveRows([1, 3], 0);

    expect(ids(items.value)).toEqual(["A", "B", "C", "D"]);
    expect(reload).toHaveBeenCalledOnce();
    expect(selection.value).toEqual([]);
  });

  it("moves the selected block by keyboard and says where the row went", () => {
    apiMock.movePlaylistTracks.mockResolvedValue();
    const { items, reorder } = setup(["A", "B", "C", "D", "E"], [1, 3]);

    // the grabbed row D is the block's second row
    const movedTo = reorder.moveBy(3, 1);

    expect(ids(items.value)).toEqual(["A", "C", "E", "B", "D"]);
    expect(movedTo).toBe(4);
    expect(apiMock.movePlaylistTracks).toHaveBeenCalledWith("1", [2, 4], 4);
  });

  it("holds back other moves of the playlist while one saves", async () => {
    let finishSave = () => {};
    apiMock.movePlaylistTrack.mockImplementation(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const { reorder } = setup(["A", "B", "C"], []);

    const move = reorder.moveRows([0], 2);

    expect(isPlaylistMoveSaving("1")).toBe(true);
    expect(reorder.moveBy(0, 1)).toBeUndefined();
    finishSave();
    await move;
    expect(isPlaylistMoveSaving("1")).toBe(false);
  });

  it("reads the order back once a move from the menu is done", async () => {
    let finishMove = () => {};
    const { reload, reorder } = setup(["A", "B", "C"], []);

    const sent = sendPlaylistMove(
      "1",
      () => new Promise<void>((resolve) => (finishMove = resolve)),
    );
    expect(reorder.saving.value).toBe(true);
    finishMove();
    await sent;
    await flushPromises();

    expect(reload).toHaveBeenCalledOnce();
    expect(reorder.saving.value).toBe(false);
  });
});
