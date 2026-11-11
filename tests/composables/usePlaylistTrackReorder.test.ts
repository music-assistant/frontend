import {
  isPlaylistEditPending,
  sendPlaylistEdit,
  untilTaskEnds,
  usePlaylistTrackReorder,
} from "@/composables/usePlaylistTrackReorder";
import {
  EventType,
  TaskStatus,
  type BackgroundTask,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import type { CommandOptions } from "@/plugins/api";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref, toRaw } from "vue";
import { track } from "../fixtures/track";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    movePlaylistTrack: vi.fn<() => Promise<void>>(),
    movePlaylistTracks: vi.fn<() => Promise<void>>(),
    subscribe: vi.fn(),
    getTasks: vi.fn<(options?: CommandOptions) => Promise<BackgroundTask[]>>(),
    state: { value: "initialized" } as { value: string },
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

function setup(
  ids: string[],
  selectedIndices: number[],
  playlistId = ref("1"),
) {
  const items = ref<MediaItemType[]>(listing(...ids));
  const listEl = document.createElement("div");
  document.body.append(listEl);
  // the listing hands out reactive rows, as a selection holds them
  const selection = ref<MediaItemType[]>(
    selectedIndices.map((index) => items.value[index]),
  );
  const reload = vi.fn(async () => {});
  const onReloaded = vi.fn();
  let reorder!: ReturnType<typeof usePlaylistTrackReorder>;
  const wrapper = mount(
    defineComponent({
      setup() {
        reorder = usePlaylistTrackReorder({
          listEl: ref(listEl),
          items,
          playlistId: () => playlistId.value,
          inOwnOrder: () => true,
          selectedIndices: () => selectedIndices,
          rowHeight: 56,
          reload,
          onReloaded,
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
  mounted.push({
    unmount: () => {
      wrapper.unmount();
      listEl.remove();
    },
  });
  return { items, selection, reload, onReloaded, reorder };
}

const ids = (items: MediaItemType[]) => items.map((item) => item.item_id);
const positions = (items: MediaItemType[]) =>
  items.map((item) => ("position" in item ? item.position : undefined));

describe("usePlaylistTrackReorder", () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.clearAllMocks();
    apiMock.state = { value: "initialized" };
  });

  it("leaves the rows alone while the server is out of reach", async () => {
    apiMock.state.value = "reconnecting";
    const { items, reload, reorder } = setup(["A", "B", "C"], []);

    await reorder.moveRows([0], 2);
    await sendPlaylistEdit("1", async () => {});

    expect(ids(items.value)).toEqual(["A", "B", "C"]);
    expect(apiMock.movePlaylistTrack).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(isPlaylistEditPending("1")).toBe(false);
  });

  it("reads the rows back on reconnect before edits are offered again", async () => {
    const state = ref("initialized");
    apiMock.state = state;
    const { reload, reorder } = setup(["A", "B", "C"], []);
    let finishReload = () => {};
    reload.mockImplementation(
      () => new Promise<void>((resolve) => (finishReload = resolve)),
    );

    state.value = "reconnecting";
    state.value = "initialized";

    // held at once, before the listing offers its edits again
    expect(reorder.saving.value).toBe(true);
    await flushPromises();
    expect(reload).toHaveBeenCalledOnce();
    expect(reorder.saving.value).toBe(true);
    finishReload();
    await flushPromises();
    expect(reorder.saving.value).toBe(false);
  });

  it("keeps the moved tracks selected, with their new positions", async () => {
    let finishSave = () => {};
    apiMock.movePlaylistTracks.mockImplementation(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const { items, selection, onReloaded, reorder } = setup(
      ["A", "B", "C", "D"],
      [1, 3],
    );

    const move = reorder.moveRows([1, 3], 0);
    await flushPromises();

    expect(ids(selection.value)).toEqual(["B", "D"]);
    expect(positions(selection.value)).toEqual([1, 2]);
    // the selection holds the moved rows themselves, not copies of them
    expect(toRaw(selection.value[0])).toBe(toRaw(items.value[0]));

    finishSave();
    await move;
    // the listing picks the selected tracks out of the rows read back
    expect(onReloaded).toHaveBeenCalledOnce();
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

  it("matches a failed move's rows back to their places when a track is listed twice", async () => {
    apiMock.movePlaylistTrack.mockRejectedValue(new Error("failed"));
    const { items, selection, reload, onReloaded, reorder } = setup(
      ["A", "B", "A", "C"],
      [2],
    );
    reload.mockImplementation(async () => {
      items.value = listing("A", "B", "A", "C");
    });

    await reorder.moveRows([2], 0);

    const locate = onReloaded.mock.lastCall![0];
    // the second A was selected and moved, so it is the second A again
    expect(locate(selection.value[0])).toBe(toRaw(items.value)[2]);
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
    expect(apiMock.movePlaylistTrack).toHaveBeenCalledWith("1", 2, 3);
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
    expect(isPlaylistEditPending("1")).toBe(true);
    expect(reorder.moveBy(0, 1)).toBeUndefined();
    finishReload();
    await move;
    expect(isPlaylistEditPending("1")).toBe(false);
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

    expect(isPlaylistEditPending("1")).toBe(true);
    expect(reorder.moveBy(0, 1)).toBeUndefined();
    finishSave();
    await move;
    expect(isPlaylistEditPending("1")).toBe(false);
  });

  it("reads the order back when the server turns a menu edit away", async () => {
    const { reload, reorder } = setup(["A", "B", "C"], []);

    const made = await sendPlaylistEdit("1", async () => {
      throw new Error("Another edit of this playlist is running");
    });
    await flushPromises();

    expect(made).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
    expect(reorder.saving.value).toBe(false);
    expect(isPlaylistEditPending("1")).toBe(false);
  });

  it("reads the order back after a move saved by a listing closed meanwhile", async () => {
    let finishSave = () => {};
    apiMock.movePlaylistTrack.mockImplementation(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const closed = setup(["A", "B", "C"], []);
    const move = closed.reorder.moveRows([0], 2);
    mounted.shift()!.unmount();
    // the playlist reopens while the move saves, loading the old order
    const reopened = setup(["A", "B", "C"], []);
    expect(reopened.reorder.saving.value).toBe(true);

    finishSave();
    await move;
    expect(reopened.reload).toHaveBeenCalledOnce();
    await flushPromises();
    expect(reopened.reorder.saving.value).toBe(false);

    // nothing to read back after this listing's own move
    apiMock.movePlaylistTrack.mockResolvedValue();
    await reopened.reorder.moveRows([0], 1);
    expect(reopened.reload).toHaveBeenCalledTimes(2);
  });

  it("reads the order back once an edit from the menu is done", async () => {
    let finishMove = () => {};
    let finishReload = () => {};
    const { reload, reorder } = setup(["A", "B", "C"], []);
    reload.mockImplementation(
      () => new Promise<void>((resolve) => (finishReload = resolve)),
    );

    const sent = sendPlaylistEdit(
      "1",
      () => new Promise<void>((resolve) => (finishMove = resolve)),
    );
    expect(reorder.saving.value).toBe(true);
    finishMove();
    await sent;
    await flushPromises();

    expect(reload).toHaveBeenCalledOnce();
    // the listing's hold took over from the edit's
    expect(reorder.saving.value).toBe(true);
    finishReload();
    await flushPromises();
    expect(reorder.saving.value).toBe(false);
  });

  it("moves the dragged row where it is dropped", async () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    const { items, reorder } = setup(["A", "B", "C"], []);

    dragFirstRowToThird(reorder);
    window.dispatchEvent(pointer("pointerup", 140));
    await flushPromises();

    expect(ids(items.value)).toEqual(["B", "C", "A"]);
    expect(apiMock.movePlaylistTrack).toHaveBeenCalledWith("1", 1, 3);
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
});

describe("untilTaskEnds", () => {
  const task = (status: TaskStatus) => ({ id: "t1", status }) as BackgroundTask;
  let report: (event: { data: BackgroundTask[] }) => void = () => {};

  afterEach(() => {
    vi.clearAllMocks();
    apiMock.state = { value: "initialized" };
  });

  // waits for the task the reply, once given, tells of
  const waitFor = (status: TaskStatus) => {
    apiMock.subscribe.mockImplementation((event, callback) => {
      if (event === EventType.TASKS_UPDATED) report = callback;
      return vi.fn();
    });
    // until reported otherwise, the server lists the task as it was sent
    apiMock.getTasks.mockResolvedValue([task(status)]);
    let reply = () => {};
    let ended = false;
    void untilTaskEnds(
      () =>
        new Promise<BackgroundTask>(
          (resolve) => (reply = () => resolve(task(status))),
        ),
    ).then(() => (ended = true));
    return {
      ended: () => ended,
      reply: async () => {
        reply();
        await flushPromises();
      },
    };
  };

  it("resolves once the task is reported finished", async () => {
    const { ended, reply } = waitFor(TaskStatus.PENDING);
    await reply();

    report({ data: [task(TaskStatus.RUNNING)] });
    await flushPromises();
    expect(ended()).toBe(false);
    report({ data: [task(TaskStatus.FAILED)] });
    await flushPromises();
    expect(ended()).toBe(true);
  });

  it("resolves when the task was reported finished before its reply", async () => {
    const { ended, reply } = waitFor(TaskStatus.PENDING);

    report({ data: [task(TaskStatus.SUCCESS)] });
    await flushPromises();
    expect(ended()).toBe(false);
    await reply();
    expect(ended()).toBe(true);
  });

  it("does not take a list from before its reply for the task's end", async () => {
    const { ended, reply } = waitFor(TaskStatus.PENDING);

    // sent before the task was created
    report({ data: [] });
    await reply();
    expect(ended()).toBe(false);
  });

  it("fails when the task could not be sent", async () => {
    apiMock.subscribe.mockReturnValue(vi.fn());

    await expect(
      untilTaskEnds(() => Promise.reject(new Error("denied"))),
    ).rejects.toThrow("denied");
  });

  it("resolves once the task is no longer listed", async () => {
    const { ended, reply } = waitFor(TaskStatus.RUNNING);
    await reply();

    report({ data: [] });
    await flushPromises();
    expect(ended()).toBe(true);
  });

  it("looks the task up again once the server is reached again", async () => {
    const state = ref("initialized");
    apiMock.state = state;
    const { ended, reply } = waitFor(TaskStatus.RUNNING);
    await reply();

    state.value = "reconnecting";
    await flushPromises();
    apiMock.getTasks.mockResolvedValue([task(TaskStatus.RUNNING)]);
    state.value = "initialized";
    await flushPromises();
    expect(ended()).toBe(false);

    state.value = "reconnecting";
    await flushPromises();
    apiMock.getTasks.mockResolvedValue([]);
    state.value = "initialized";
    await flushPromises();
    expect(ended()).toBe(true);
    // an account that may not list the tasks gets no error toast for it
    expect(apiMock.getTasks).toHaveBeenCalledWith({
      suppressGlobalError: true,
    });
  });

  it("waits for the next report when the tasks cannot be listed", async () => {
    const state = ref("initialized");
    apiMock.state = state;
    const { ended, reply } = waitFor(TaskStatus.RUNNING);
    await reply();
    apiMock.getTasks.mockRejectedValue(new Error("missing scope"));

    state.value = "reconnecting";
    await flushPromises();
    state.value = "initialized";
    await flushPromises();
    expect(ended()).toBe(false);
    report({ data: [task(TaskStatus.SUCCESS)] });
    await flushPromises();
    expect(ended()).toBe(true);
  });
});
