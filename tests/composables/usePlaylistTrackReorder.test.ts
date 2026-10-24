import {
  isPlaylistEditPending,
  sendPlaylistEdit,
  untilPlaylistRemovalsEnd,
  untilTaskEnds,
  usePlaylistTrackReorder,
} from "@/composables/usePlaylistTrackReorder";
import {
  TaskStatus,
  type BackgroundTask,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { ApiCommandError } from "@/plugins/api/errors";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref, toRaw } from "vue";
import { track } from "../fixtures/track";

const { apiMock, ConnectionLostError } = vi.hoisted(() => ({
  ConnectionLostError: class ConnectionLostError extends Error {},
  apiMock: {
    movePlaylistTrack: vi.fn<() => Promise<void>>(),
    movePlaylistTracks: vi.fn<() => Promise<void>>(),
    subscribe: vi.fn(),
    getTask: vi.fn<() => Promise<BackgroundTask>>(),
    getTasks: vi.fn<() => Promise<BackgroundTask[]>>(),
    state: { value: "initialized" } as { value: string },
  },
}));

vi.mock("@/plugins/api", async () => ({
  api: apiMock,
  default: apiMock,
  ConnectionState: { INITIALIZED: "initialized" },
  ConnectionLostError,
  ApiCommandError: (await import("@/plugins/api/errors")).ApiCommandError,
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

  it("keeps the playlist's edits held until a removal with a lost reply ends", async () => {
    const state = ref("initialized");
    apiMock.state = state;
    apiMock.subscribe.mockReturnValue(vi.fn());
    let done = false;
    void sendPlaylistEdit("1", async () => {
      state.value = "reconnecting";
      throw new ConnectionLostError();
    }).then(() => (done = true));
    await flushPromises();
    expect(isPlaylistEditPending("1")).toBe(true);

    // the removal is still queued on the server once it is reached again
    apiMock.getTasks.mockResolvedValue([
      {
        id: "t1",
        status: TaskStatus.PENDING,
        metadata: { task_domain: "playlist_remove_tracks", playlist_id: "1" },
      } as unknown as BackgroundTask,
    ]);
    apiMock.getTask.mockResolvedValue({
      id: "t1",
      status: TaskStatus.SUCCESS,
    } as BackgroundTask);
    state.value = "initialized";
    await flushPromises();
    expect(done).toBe(false);
    expect(isPlaylistEditPending("1")).toBe(true);

    // its end is only seen on the next lookup
    state.value = "reconnecting";
    await flushPromises();
    state.value = "initialized";
    await flushPromises();
    expect(done).toBe(true);
    expect(isPlaylistEditPending("1")).toBe(false);
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

  describe("untilPlaylistRemovalsEnd", () => {
    const removal = (id: string, playlistId: string, status: TaskStatus) =>
      ({
        id,
        status,
        metadata: {
          task_domain: "playlist_remove_tracks",
          playlist_id: playlistId,
        },
      }) as unknown as BackgroundTask;

    it("resolves when no removal of the playlist is running", async () => {
      apiMock.getTasks.mockResolvedValue([
        removal("t1", "2", TaskStatus.RUNNING),
        removal("t2", "1", TaskStatus.SUCCESS),
        {
          id: "t3",
          status: TaskStatus.RUNNING,
          metadata: {},
        } as BackgroundTask,
      ]);
      let ended = false;
      void untilPlaylistRemovalsEnd("1").then(() => (ended = true));
      await flushPromises();

      expect(ended).toBe(true);
    });

    it("waits for a running removal of the playlist", async () => {
      let report: (event: { data: BackgroundTask[] }) => void = () => {};
      apiMock.subscribe.mockImplementation((_type, callback) => {
        report = callback;
        return vi.fn();
      });
      apiMock.getTasks.mockResolvedValue([
        removal("t1", "1", TaskStatus.RUNNING),
      ]);
      let ended = false;
      void untilPlaylistRemovalsEnd("1").then(() => (ended = true));
      await flushPromises();
      expect(ended).toBe(false);

      report({ data: [removal("t1", "1", TaskStatus.SUCCESS)] });
      await flushPromises();
      expect(ended).toBe(true);
    });

    it("waits for the server to be reached before looking", async () => {
      const state = ref("reconnecting");
      apiMock.state = state;
      apiMock.getTasks.mockResolvedValue([]);
      let ended = false;
      void untilPlaylistRemovalsEnd("1").then(() => (ended = true));
      await flushPromises();
      expect(apiMock.getTasks).not.toHaveBeenCalled();

      state.value = "initialized";
      await flushPromises();
      expect(ended).toBe(true);
    });
  });

  describe("untilTaskEnds", () => {
    const task = (id: string, status: TaskStatus) =>
      ({ id, status }) as BackgroundTask;

    it("resolves once the task is reported finished", async () => {
      let report: (event: { data: BackgroundTask[] }) => void = () => {};
      const unsubscribe = vi.fn();
      apiMock.subscribe.mockImplementation((_type, callback) => {
        report = callback;
        return unsubscribe;
      });
      let ended = false;
      const waiting = untilTaskEnds(task("t1", TaskStatus.PENDING)).then(
        () => (ended = true),
      );

      report({ data: [task("t1", TaskStatus.RUNNING)] });
      await flushPromises();
      expect(ended).toBe(false);
      report({ data: [task("t1", TaskStatus.SUCCESS)] });
      await waiting;

      expect(unsubscribe).toHaveBeenCalledOnce();
    });

    /** Waits on a pending task across a dropped and restored connection. */
    async function waitAcrossReconnect() {
      const unsubscribe = vi.fn();
      apiMock.subscribe.mockReturnValue(unsubscribe);
      const state = ref("initialized");
      apiMock.state = state;
      let ended = false;
      void untilTaskEnds(task("t1", TaskStatus.PENDING)).then(
        () => (ended = true),
      );
      // the end could have been reported while the connection was down
      state.value = "reconnecting";
      await flushPromises();
      expect(ended).toBe(false);
      state.value = "initialized";
      await flushPromises();
      return { ended: () => ended, unsubscribe };
    }

    it("stops waiting when the task finished while disconnected", async () => {
      apiMock.getTask.mockResolvedValue(task("t1", TaskStatus.SUCCESS));

      const { ended, unsubscribe } = await waitAcrossReconnect();

      expect(apiMock.getTask).toHaveBeenCalledWith("t1");
      expect(ended()).toBe(true);
      expect(unsubscribe).toHaveBeenCalledOnce();
    });

    it("stops waiting when the server no longer holds the task", async () => {
      apiMock.getTask.mockRejectedValue(
        new ApiCommandError("Task t1 not found", 3),
      );

      const { ended } = await waitAcrossReconnect();

      expect(ended()).toBe(true);
    });

    it("keeps waiting when the task still runs after a reconnect", async () => {
      apiMock.getTask.mockResolvedValue(task("t1", TaskStatus.RUNNING));

      const { ended } = await waitAcrossReconnect();

      expect(ended()).toBe(false);
    });

    it("keeps waiting when the task can't be looked up", async () => {
      apiMock.getTask.mockRejectedValue(
        new ApiCommandError("Insufficient permissions", 22),
      );

      const { ended } = await waitAcrossReconnect();

      expect(ended()).toBe(false);
    });

    it("keeps waiting while the task's end goes unreported", async () => {
      apiMock.subscribe.mockReturnValue(vi.fn());
      let ended = false;
      void untilTaskEnds(task("t1", TaskStatus.PENDING)).then(
        () => (ended = true),
      );

      await flushPromises();

      expect(ended).toBe(false);
    });
  });
});
