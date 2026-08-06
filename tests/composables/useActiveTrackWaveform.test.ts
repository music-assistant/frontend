import { effectScope, nextTick, reactive, type EffectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetWaveForm } = vi.hoisted(() => ({
  mockGetWaveForm: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: { getWaveForm: mockGetWaveForm },
}));

// Reactive store mock so the composable's watch fires when we mutate it.
const storeMock = reactive({
  curQueueItem: null as unknown,
  currentUser: null as unknown,
});

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/api/interfaces", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/plugins/api/interfaces")>();
  return { ...actual };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueueItem(overrides: Record<string, unknown> = {}) {
  return {
    queue_item_id: "qi-1",
    duration: 240,
    media_item: {
      item_id: "track-1",
      provider: "spotify",
      media_type: "track",
    },
    streamdetails: {
      item_id: "stream-1",
      provider: "spotify",
    },
    ...overrides,
  };
}

type UseActiveTrackWaveform =
  typeof import("@/composables/useActiveTrackWaveform").useActiveTrackWaveform;

let scopes: EffectScope[] = [];

/**
 * Imports a fresh copy of the composable module.
 */
async function importComposable(): Promise<UseActiveTrackWaveform> {
  const module = await import("@/composables/useActiveTrackWaveform");
  return module.useActiveTrackWaveform;
}

/**
 * Registers a consumer inside its own effect scope, mimicking a mounted
 * component. The returned scope can be stopped to simulate unmounting.
 */
function addConsumer(useActiveTrackWaveform: UseActiveTrackWaveform) {
  const scope = effectScope();
  scopes.push(scope);
  return { scope, ...scope.run(useActiveTrackWaveform)! };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useActiveTrackWaveform", () => {
  beforeEach(async () => {
    // A fresh module per test, so the shared cache and consumer count reset.
    // This relies on "vue" staying a single instance across the reset, so that
    // effect scopes created here are the ones the composable sees.
    vi.resetModules();
    mockGetWaveForm.mockReset();
    scopes = [];
    storeMock.curQueueItem = null;
    storeMock.currentUser = null;
    await nextTick();
  });

  afterEach(() => {
    scopes.forEach((scope) => scope.stop());
  });

  it("fetches waveform and sets bins when track with streamdetails plays", async () => {
    mockGetWaveForm.mockResolvedValueOnce([0.1, 0.5, 0.9]);

    const { waveformBins, trackDurationSecs } = addConsumer(
      await importComposable(),
    );

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick(); // await async watch body

    expect(mockGetWaveForm).toHaveBeenCalledWith("stream-1", "spotify");
    expect(waveformBins.value).toEqual([0.1, 0.5, 0.9]);
    expect(trackDurationSecs.value).toBe(240);
  });

  it("does not fetch when media_type is not track", async () => {
    const { waveformBins } = addConsumer(await importComposable());

    storeMock.curQueueItem = makeQueueItem({
      media_item: { item_id: "r-1", provider: "spotify", media_type: "radio" },
    });
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).not.toHaveBeenCalled();
    expect(waveformBins.value).toBeNull();
  });

  it("does not fetch when streamdetails are absent", async () => {
    const { waveformBins } = addConsumer(await importComposable());

    storeMock.curQueueItem = makeQueueItem({ streamdetails: undefined });
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).not.toHaveBeenCalled();
    expect(waveformBins.value).toBeNull();
  });

  it("keeps waveformBins null when api throws", async () => {
    mockGetWaveForm.mockRejectedValueOnce(new Error("no analysis"));

    const { waveformBins } = addConsumer(await importComposable());

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();

    expect(waveformBins.value).toBeNull();
  });

  it("keeps waveformBins null when api returns empty array", async () => {
    mockGetWaveForm.mockResolvedValueOnce([]);

    const { waveformBins } = addConsumer(await importComposable());

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();

    expect(waveformBins.value).toBeNull();
  });

  it("ignores stale result when track changes before fetch resolves", async () => {
    let resolve1!: (v: number[]) => void;
    const promise1 = new Promise<number[]>((r) => (resolve1 = r));
    mockGetWaveForm
      .mockReturnValueOnce(promise1)
      .mockResolvedValueOnce([0.8, 0.9]);

    const { waveformBins } = addConsumer(await importComposable());

    // Start first fetch.
    storeMock.curQueueItem = makeQueueItem({ queue_item_id: "qi-1" });
    await nextTick();

    // Switch to second track before first resolves.
    storeMock.curQueueItem = makeQueueItem({
      queue_item_id: "qi-2",
      streamdetails: { item_id: "stream-2", provider: "spotify" },
    });
    await nextTick();
    await nextTick(); // second fetch resolves

    // Now resolve the first (stale) fetch.
    resolve1([0.1, 0.2]);
    await nextTick();

    // Only the second result should be stored.
    expect(waveformBins.value).toEqual([0.8, 0.9]);
  });

  it("does not re-fetch when the same queue_item_id is set again", async () => {
    mockGetWaveForm.mockResolvedValue([0.5]);

    addConsumer(await importComposable());

    storeMock.curQueueItem = makeQueueItem({ queue_item_id: "qi-same" });
    await nextTick();
    await nextTick();

    storeMock.curQueueItem = { ...makeQueueItem({ queue_item_id: "qi-same" }) };
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);
  });

  it("does not fetch while the module is imported but unused", async () => {
    mockGetWaveForm.mockResolvedValue([0.5]);

    await importComposable();

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).not.toHaveBeenCalled();
  });

  it("stops fetching once the last consumer is torn down", async () => {
    mockGetWaveForm.mockResolvedValue([0.5]);

    const { scope } = addConsumer(await importComposable());

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();
    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);

    scope.stop();

    storeMock.curQueueItem = makeQueueItem({
      queue_item_id: "qi-2",
      streamdetails: { item_id: "stream-2", provider: "spotify" },
    });
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);
  });

  it("keeps fetching while another consumer is still alive", async () => {
    mockGetWaveForm.mockResolvedValue([0.5]);

    const useActiveTrackWaveform = await importComposable();
    const first = addConsumer(useActiveTrackWaveform);
    addConsumer(useActiveTrackWaveform);

    first.scope.stop();

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);
  });

  it("shares one fetch and the same state between consumers", async () => {
    mockGetWaveForm.mockResolvedValue([0.5]);

    const useActiveTrackWaveform = await importComposable();
    const first = addConsumer(useActiveTrackWaveform);
    const second = addConsumer(useActiveTrackWaveform);

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);
    expect(first.waveformBins).toBe(second.waveformBins);
    expect(second.waveformBins.value).toEqual([0.5]);
  });

  it("does not fetch when the show_waveform preference is off", async () => {
    mockGetWaveForm.mockResolvedValue([0.5]);
    storeMock.currentUser = { preferences: { show_waveform: false } };

    const { waveformBins } = addConsumer(await importComposable());

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).not.toHaveBeenCalled();
    expect(waveformBins.value).toBeNull();
  });

  it("fetches once the show_waveform preference is switched back on", async () => {
    mockGetWaveForm.mockResolvedValue([0.5]);
    storeMock.currentUser = { preferences: { show_waveform: false } };

    const { waveformBins } = addConsumer(await importComposable());

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();
    expect(mockGetWaveForm).not.toHaveBeenCalled();

    storeMock.currentUser = { preferences: { show_waveform: true } };
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);
    expect(waveformBins.value).toEqual([0.5]);
  });

  it("refetches when the track changed while no consumer was alive", async () => {
    mockGetWaveForm.mockResolvedValueOnce([0.5]).mockResolvedValueOnce([0.7]);

    const useActiveTrackWaveform = await importComposable();
    const first = addConsumer(useActiveTrackWaveform);

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();

    first.scope.stop();

    storeMock.curQueueItem = makeQueueItem({
      queue_item_id: "qi-2",
      streamdetails: { item_id: "stream-2", provider: "spotify" },
    });

    const second = addConsumer(useActiveTrackWaveform);
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).toHaveBeenCalledTimes(2);
    expect(second.waveformBins.value).toEqual([0.7]);
  });

  it("discards a fetch that resolves after the last consumer is torn down", async () => {
    let resolveFirst!: (v: number[]) => void;
    mockGetWaveForm
      .mockReturnValueOnce(new Promise<number[]>((r) => (resolveFirst = r)))
      .mockResolvedValueOnce([0.9]);

    const useActiveTrackWaveform = await importComposable();
    const first = addConsumer(useActiveTrackWaveform);

    const trackA = makeQueueItem();
    const trackB = makeQueueItem({
      queue_item_id: "qi-2",
      streamdetails: { item_id: "stream-2", provider: "spotify" },
    });

    // Track A's fetch hangs, then track B plays and resolves.
    storeMock.curQueueItem = trackA;
    await nextTick();
    storeMock.curQueueItem = trackB;
    await nextTick();
    await nextTick();
    expect(first.waveformBins.value).toEqual([0.9]);

    first.scope.stop();

    // Track A comes around again unobserved and its stale fetch resolves.
    storeMock.curQueueItem = trackA;
    resolveFirst([0.1]);
    await nextTick();

    // Track B is playing again when a consumer returns, so the cached bins
    // must still be B's rather than the late arrival from A.
    storeMock.curQueueItem = trackB;
    const second = addConsumer(useActiveTrackWaveform);
    await nextTick();
    await nextTick();

    expect(second.waveformBins.value).toEqual([0.9]);
  });

  it("reuses the cached bins when a consumer remounts on the same track", async () => {
    mockGetWaveForm.mockResolvedValue([0.5]);

    const useActiveTrackWaveform = await importComposable();
    const first = addConsumer(useActiveTrackWaveform);

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();
    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);

    first.scope.stop();

    const second = addConsumer(useActiveTrackWaveform);
    await nextTick();

    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);
    expect(second.waveformBins.value).toEqual([0.5]);
  });
});
