import {
  isPlaylistEditPending,
  usePlaylistTrackReorder,
} from "@/composables/usePlaylistTrackReorder";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { track } from "../fixtures/track";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    movePlaylistTrack: vi.fn<() => Promise<void>>(),
    state: { value: "initialized" },
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

function setup(ids: string[], playlistId = ref("1")) {
  const items = ref<MediaItemType[]>(listing(...ids));
  const listEl = document.createElement("div");
  document.body.append(listEl);
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
          rowHeight: 56,
          reload,
          onReloaded,
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
  return { items, reload, onReloaded, reorder };
}

const ids = (items: MediaItemType[]) => items.map((item) => item.item_id);

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

  it("shows the move at once and reads the order back once it is saved", async () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    const { items, reload, onReloaded, reorder } = setup(["A", "B", "C"]);

    const move = reorder.move(0, 2);

    expect(ids(items.value)).toEqual(["B", "C", "A"]);
    expect(reorder.saving.value).toBe(true);
    await move;

    expect(apiMock.movePlaylistTrack).toHaveBeenCalledWith("1", 1, 3);
    expect(reload).toHaveBeenCalledOnce();
    expect(onReloaded).toHaveBeenCalledOnce();
    expect(reorder.saving.value).toBe(false);
  });

  it("reads the provider's order back when saving fails", async () => {
    apiMock.movePlaylistTrack.mockRejectedValue(new Error("failed"));
    const { items, reload, reorder } = setup(["A", "B", "C"]);
    reload.mockImplementation(async () => {
      items.value = listing("A", "B", "C");
    });

    await reorder.move(0, 2);

    expect(reload).toHaveBeenCalledOnce();
    expect(ids(items.value)).toEqual(["A", "B", "C"]);
    expect(reorder.saving.value).toBe(false);
  });

  it("holds back other moves until the order is read back", async () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    let finishReload = () => {};
    const { items, reload, reorder } = setup(["A", "B", "C"]);
    reload.mockImplementation(
      () => new Promise<void>((resolve) => (finishReload = resolve)),
    );

    const move = reorder.move(0, 1);
    await flushPromises();

    expect(reload).toHaveBeenCalledOnce();
    // the track menu holds back removals of the playlist as well
    expect(isPlaylistEditPending("1")).toBe(true);
    expect(reorder.moveBy(0, 1)).toBeUndefined();
    expect(ids(items.value)).toEqual(["B", "A", "C"]);
    finishReload();
    await move;
    expect(apiMock.movePlaylistTrack).toHaveBeenCalledOnce();
    expect(isPlaylistEditPending("1")).toBe(false);
  });

  it("reads the order again when the playlist changed during a read back", async () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    let finishReload = () => {};
    const { reload, reorder } = setup(["A", "B", "C"]);
    reload.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishReload = resolve)),
    );

    const move = reorder.move(0, 1);
    await flushPromises();
    // another client changed the playlist after the rows were requested
    await reorder.refresh();
    expect(reload).toHaveBeenCalledOnce();
    finishReload();
    await move;

    expect(reload).toHaveBeenCalledTimes(2);
    expect(reorder.saving.value).toBe(false);
  });

  it("moves the dragged row where it is dropped", async () => {
    apiMock.movePlaylistTrack.mockResolvedValue();
    const { items, reorder } = setup(["A", "B", "C"]);

    dragFirstRowToThird(reorder);
    window.dispatchEvent(pointer("pointerup", 140));
    await flushPromises();

    expect(ids(items.value)).toEqual(["B", "C", "A"]);
    expect(apiMock.movePlaylistTrack).toHaveBeenCalledWith("1", 1, 3);
  });

  it("drops nothing when the rows were replaced during the drag", async () => {
    const { items, reorder } = setup(["A", "B", "C"]);

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
    const { items, reorder } = setup(["A", "B", "C"], playlistId);

    dragFirstRowToThird(reorder);
    playlistId.value = "2";
    window.dispatchEvent(pointer("pointerup", 140));
    await flushPromises();

    expect(ids(items.value)).toEqual(["A", "B", "C"]);
    expect(apiMock.movePlaylistTrack).not.toHaveBeenCalled();
  });
});
