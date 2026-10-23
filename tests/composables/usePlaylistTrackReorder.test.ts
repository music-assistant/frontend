import { usePlaylistTrackReorder } from "@/composables/usePlaylistTrackReorder";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { track } from "../fixtures/track";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    movePlaylistTrack: vi.fn<() => Promise<void>>(),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

const listing = (...ids: string[]): MediaItemType[] =>
  ids.map((id, index) => track({ item_id: id, position: index + 1 }));

const mounted: { unmount: () => void }[] = [];

function setup(ids: string[]) {
  const items = ref<MediaItemType[]>(listing(...ids));
  const reload = vi.fn(async () => {});
  const onReloaded = vi.fn();
  let reorder!: ReturnType<typeof usePlaylistTrackReorder>;
  const wrapper = mount(
    defineComponent({
      setup() {
        reorder = usePlaylistTrackReorder({
          listEl: ref(null),
          items,
          playlistId: () => "1",
          rowHeight: 56,
          reload,
          onReloaded,
        });
        return () => null;
      },
    }),
  );
  mounted.push(wrapper);
  return { items, reload, onReloaded, reorder };
}

const ids = (items: MediaItemType[]) => items.map((item) => item.item_id);

describe("usePlaylistTrackReorder", () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount());
    vi.clearAllMocks();
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
    expect(reorder.moveBy(0, 1)).toBeUndefined();
    expect(ids(items.value)).toEqual(["B", "A", "C"]);
    finishReload();
    await move;
    expect(apiMock.movePlaylistTrack).toHaveBeenCalledOnce();
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
});
