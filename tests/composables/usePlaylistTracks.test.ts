import { usePlaylistTracks } from "@/composables/usePlaylistTracks";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../fixtures/track";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getPlaylistTracks: vi.fn() },
}));
vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

/** A request the test settles itself, to order responses. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("usePlaylistTracks", () => {
  const playlist = { itemId: "1", provider: "library" };

  beforeEach(() => {
    apiMock.getPlaylistTracks.mockReset();
    playlist.itemId = "1";
  });

  it("shares one request between the page and the listing", async () => {
    const tracks = [track()];
    apiMock.getPlaylistTracks.mockResolvedValue(tracks);
    const { tracks: loaded, load } = usePlaylistTracks(() => playlist);

    const first = load();
    expect(load()).toBe(first);
    await flushPromises();

    expect(apiMock.getPlaylistTracks).toHaveBeenCalledTimes(1);
    expect(loaded.value).toEqual(tracks);
  });

  it("asks again on a refresh", async () => {
    apiMock.getPlaylistTracks.mockResolvedValue([]);
    const { load } = usePlaylistTracks(() => playlist);

    load();
    load(true);
    await flushPromises();

    expect(apiMock.getPlaylistTracks).toHaveBeenLastCalledWith(
      "1",
      "library",
      true,
      undefined,
      undefined,
      0,
    );
    expect(apiMock.getPlaylistTracks).toHaveBeenCalledTimes(2);
  });

  it("keeps the tracks of the latest request when an older one lands last", async () => {
    const older = deferred<ReturnType<typeof track>[]>();
    const newer = [track({ name: "newer" })];
    apiMock.getPlaylistTracks
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(newer);
    const { tracks: loaded, load } = usePlaylistTracks(() => playlist);

    load();
    load(true);
    await flushPromises();
    older.resolve([track({ name: "older" })]);
    await flushPromises();

    expect(loaded.value).toEqual(newer);
  });

  it("drops a response for a playlist the page has moved away from", async () => {
    const previous = deferred<ReturnType<typeof track>[]>();
    apiMock.getPlaylistTracks.mockReturnValueOnce(previous.promise);
    const { tracks: loaded, load, reset } = usePlaylistTracks(() => playlist);

    load();
    playlist.itemId = "2";
    reset();
    previous.resolve([track()]);
    await flushPromises();

    expect(loaded.value).toBeUndefined();
  });

  it("asks again after a failed request", async () => {
    apiMock.getPlaylistTracks
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    const { load } = usePlaylistTracks(() => playlist);

    await expect(load()).rejects.toThrow("offline");
    await load();

    expect(apiMock.getPlaylistTracks).toHaveBeenCalledTimes(2);
  });
});
