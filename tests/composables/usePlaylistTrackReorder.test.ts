import { usePlaylistTrackReorder } from "@/composables/usePlaylistTrackReorder";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref, toRaw } from "vue";
import { track } from "../fixtures/track";

const { apiMock } = await vi.hoisted(async () => {
  const { ref } = await import("vue");
  return {
    apiMock: {
      movePlaylistTrack: vi.fn<() => Promise<void>>(),
      movePlaylistTracks: vi.fn<() => Promise<void>>(),
      state: ref("initialized"),
    },
  };
});

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

function setup(
  ids: string[],
  selectedIndices: number[],
  playlistId = ref("1"),
  selecting = true,
) {
  const items = ref<MediaItemType[]>(listing(...ids));
  const listEl = document.createElement("div");
  document.body.append(listEl);
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
          playlistId: () => playlistId.value,
          inOwnOrder: () => true,
          selected: selection,
          selecting: () => selecting,
          rowHeight: 56,
          reload,
        });
        return () => null;
      },
    }),
  );
  mounted.push({
    unmount: () => {
      wrapper.unmount();
      listEl.remove();
    },
  });
  return { items, selection, reload, reorder, listEl };
}

/** The drag class of every row while the first row is dragged. */
async function dragClasses(selectedIndices: number[], selecting = true) {
  apiMock.movePlaylistTrack.mockResolvedValue();
  apiMock.movePlaylistTracks.mockResolvedValue();
  const { items, reorder } = setup(
    ["A", "B", "C", "D"],
    selectedIndices,
    ref("1"),
    selecting,
  );
  dragFirstRowToThird(reorder);
  const classes = items.value.map((row, index) =>
    reorder.rowDragClass(row, index),
  );
  window.dispatchEvent(pointer("pointerup", 140));
  await flushPromises();
  return classes;
}

const ids = (items: MediaItemType[]) => items.map((item) => item.item_id);
const uri = (id: string) => `library://track/${id}`;
const positions = (items: MediaItemType[]) =>
  items.map((item) => ("position" in item ? item.position : undefined));

describe("usePlaylistTrackReorder", () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.clearAllMocks();
    apiMock.state.value = "initialized";
  });

  it("keeps the moved tracks selected, with their new positions", async () => {
    let finishSave = () => {};
    apiMock.movePlaylistTracks.mockImplementation(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const { items, selection, reorder } = setup(["A", "B", "C", "D"], [1, 3]);

    const move = reorder.moveRows([1, 3], 0);
    await flushPromises();

    expect(ids(selection.value)).toEqual(["B", "D"]);
    expect(positions(selection.value)).toEqual([1, 2]);
    // the selection holds the moved rows themselves, not copies of them
    expect(toRaw(selection.value[0])).toBe(toRaw(items.value[0]));

    finishSave();
    await move;
    // the selected tracks are picked out of the rows read back
    expect(ids(selection.value)).toEqual(["B", "D"]);
  });

  it("reads the provider's order back when the move fails", async () => {
    apiMock.movePlaylistTracks.mockRejectedValue(new Error("failed"));
    const { items, reload, reorder } = setup(["A", "B", "C", "D"], [1, 3]);
    reload.mockImplementation(async () => {
      items.value = listing("A", "B", "C", "D");
    });

    await reorder.moveRows([1, 3], 0);

    expect(reload).toHaveBeenCalledOnce();
    expect(ids(items.value)).toEqual(["A", "B", "C", "D"]);
    expect(reorder.saving.value).toBe(false);
  });

  it("reads the order back once the server is back after a move lost the connection", async () => {
    apiMock.movePlaylistTracks.mockImplementation(async () => {
      apiMock.state.value = "connecting";
      throw new Error("connection lost");
    });
    const { items, selection, reload, reorder } = setup(
      ["A", "B", "C", "D"],
      [1, 3],
    );
    reload.mockImplementation(async () => {
      items.value = listing("A", "B", "C", "D");
    });

    await reorder.moveRows([1, 3], 0);
    // the rows aren't read while the server is out of reach
    expect(reload).not.toHaveBeenCalled();
    expect(selection.value).toEqual([]);
    expect(reorder.saving.value).toBe(false);

    apiMock.state.value = "initialized";
    await flushPromises();
    expect(reload).toHaveBeenCalledOnce();
    expect(ids(items.value)).toEqual(["A", "B", "C", "D"]);
  });

  it("lets go of the focus when a keyboard move lost the connection", async () => {
    apiMock.movePlaylistTrack.mockImplementation(async () => {
      apiMock.state.value = "connecting";
      throw new Error("connection lost");
    });
    const { items, reload, reorder, listEl } = setup(["A", "B", "C"], []);
    reload.mockImplementation(async () => {
      items.value = listing("A", "B", "C");
    });
    listEl.innerHTML = [0, 1, 2]
      .map((index) => `<button data-reorder-index="${index}"></button>`)
      .join("");
    listEl.querySelector<HTMLElement>('[data-reorder-index="0"]')!.focus();

    expect(reorder.moveBy(0, 1)).toBe(1);
    await flushPromises();

    // the focused row would hold another track once the order is read back
    expect(listEl.contains(document.activeElement)).toBe(false);
    apiMock.state.value = "initialized";
    await flushPromises();
    expect(reload).toHaveBeenCalledOnce();
    expect(listEl.contains(document.activeElement)).toBe(false);
  });

  it("lets the selection go when the move fails", async () => {
    apiMock.movePlaylistTrack.mockRejectedValue(new Error("failed"));
    const { items, selection, reload, reorder } = setup(
      ["A", "B", "A", "C"],
      [2],
    );
    reload.mockImplementation(async () => {
      items.value = listing("A", "B", "A", "C");
    });

    await reorder.moveRows([2], 0);

    expect(selection.value).toEqual([]);
  });

  it("moves the selected block by keyboard and says where the row went", () => {
    apiMock.movePlaylistTracks.mockResolvedValue();
    const { items, reorder } = setup(["A", "B", "C", "D", "E"], [1, 3]);

    // the grabbed row D is the block's second row
    const movedTo = reorder.moveBy(3, 1);

    expect(ids(items.value)).toEqual(["A", "C", "E", "B", "D"]);
    expect(movedTo).toBe(4);
    expect(apiMock.movePlaylistTracks).toHaveBeenCalledWith("1", [2, 4], 4, [
      uri("B"),
      uri("D"),
    ]);
  });

  it("moves a contiguous block down by keyboard from its first row", async () => {
    apiMock.movePlaylistTracks.mockResolvedValue();
    const { items, reorder } = setup(["A", "B", "C", "D"], [1, 2]);

    expect(reorder.moveBy(1, 1)).toBe(2);
    expect(ids(items.value)).toEqual(["A", "D", "B", "C"]);
    await flushPromises();
  });

  it("moves a contiguous block up by keyboard from its last row", async () => {
    apiMock.movePlaylistTracks.mockResolvedValue();
    const { items, reorder } = setup(["A", "B", "C", "D"], [1, 2]);

    expect(reorder.moveBy(2, -1)).toBe(1);
    expect(ids(items.value)).toEqual(["B", "C", "A", "D"]);
    await flushPromises();
  });

  it("moves a single row one place by keyboard", () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    const { items, reorder } = setup(["A", "B", "C"], []);

    expect(reorder.moveBy(2, 1)).toBeUndefined();
    expect(reorder.moveBy(1, 1)).toBe(2);
    expect(ids(items.value)).toEqual(["A", "C", "B"]);
    expect(apiMock.movePlaylistTrack).toHaveBeenCalledWith("1", 2, 3, uri("B"));
  });

  it("holds back other moves until the order is read back", async () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    let finishReload = () => {};
    const { reload, reorder } = setup(["A", "B", "C"], []);
    reload.mockImplementation(
      () => new Promise<void>((resolve) => (finishReload = resolve)),
    );

    const move = reorder.moveRows([0], 1);
    await flushPromises();

    expect(reload).toHaveBeenCalledOnce();
    expect(reorder.saving.value).toBe(true);
    expect(reorder.moveBy(0, 1)).toBeUndefined();
    finishReload();
    await move;
    expect(reorder.saving.value).toBe(false);
  });

  it("reads the order again when the playlist changed during a read back", async () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    let finishReload = () => {};
    const { reload, reorder } = setup(["A", "B", "C"], []);
    reload.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishReload = resolve)),
    );

    const move = reorder.moveRows([0], 1);
    await flushPromises();
    // another client changed the playlist after the rows were requested
    await reorder.refresh();
    expect(reload).toHaveBeenCalledOnce();
    finishReload();
    await move;

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("holds back other moves of the playlist while one saves", async () => {
    let finishSave = () => {};
    apiMock.movePlaylistTrack.mockImplementation(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const { reorder } = setup(["A", "B", "C"], []);

    const move = reorder.moveRows([0], 2);

    expect(reorder.saving.value).toBe(true);
    expect(reorder.moveBy(0, 1)).toBeUndefined();
    finishSave();
    await move;
    expect(reorder.saving.value).toBe(false);
  });

  it("moves the dragged row where it is dropped", async () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    const { items, reorder } = setup(["A", "B", "C"], []);

    dragFirstRowToThird(reorder);
    window.dispatchEvent(pointer("pointerup", 140));
    await flushPromises();

    expect(ids(items.value)).toEqual(["B", "C", "A"]);
    expect(apiMock.movePlaylistTrack).toHaveBeenCalledWith("1", 1, 3, uri("A"));
  });

  it("drops nothing when the rows were replaced during the drag", async () => {
    const { items, reorder } = setup(["A", "B", "C"], []);

    dragFirstRowToThird(reorder);
    // a playlist update read the rows again meanwhile
    items.value = listing("C", "A", "B");
    window.dispatchEvent(pointer("pointerup", 140));
    await flushPromises();

    expect(ids(items.value)).toEqual(["C", "A", "B"]);
    expect(apiMock.movePlaylistTrack).not.toHaveBeenCalled();
  });

  it("drops nothing when the listing moved to another playlist", async () => {
    const playlistId = ref("1");
    const { items, reorder } = setup(["A", "B", "C"], [], playlistId);

    dragFirstRowToThird(reorder);
    playlistId.value = "2";
    window.dispatchEvent(pointer("pointerup", 140));
    await flushPromises();

    expect(ids(items.value)).toEqual(["A", "B", "C"]);
    expect(apiMock.movePlaylistTrack).not.toHaveBeenCalled();
    expect(apiMock.movePlaylistTracks).not.toHaveBeenCalled();
  });

  it("hides every selected row while one of them is dragged", async () => {
    expect(await dragClasses([0, 2])).toEqual([
      "invisible",
      undefined,
      "invisible",
      undefined,
    ]);
  });

  it("hides only the dragged row when it is not part of the selection", async () => {
    expect(await dragClasses([1, 2])).toEqual([
      "invisible",
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("hides only the dragged row when the rows cannot be selected", async () => {
    expect(await dragClasses([0, 2], false)).toEqual([
      "invisible",
      undefined,
      undefined,
      undefined,
    ]);
  });
});
