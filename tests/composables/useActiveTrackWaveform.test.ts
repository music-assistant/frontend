import { nextTick, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetWaveForm } = vi.hoisted(() => ({
  mockGetWaveForm: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: { getWaveForm: mockGetWaveForm },
}));

// Reactive store mock so the module-level watch fires when we mutate it.
const storeMock = reactive({
  curQueueItem: null as unknown,
});

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/api/interfaces", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/plugins/api/interfaces")>();
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useActiveTrackWaveform", () => {
  beforeEach(async () => {
    mockGetWaveForm.mockReset();
    storeMock.curQueueItem = null;
    // Allow the immediate watch triggered by resetting to settle.
    await nextTick();
  });

  it("fetches waveform and sets bins when track with streamdetails plays", async () => {
    mockGetWaveForm.mockResolvedValueOnce([0.1, 0.5, 0.9]);

    const { useActiveTrackWaveform } = await import(
      "@/composables/useActiveTrackWaveform"
    );
    const { waveformBins, trackDurationSecs } = useActiveTrackWaveform();

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick(); // await async watch body

    expect(mockGetWaveForm).toHaveBeenCalledWith("stream-1", "spotify");
    expect(waveformBins.value).toEqual([0.1, 0.5, 0.9]);
    expect(trackDurationSecs.value).toBe(240);
  });

  it("does not fetch when media_type is not track", async () => {
    const { useActiveTrackWaveform } = await import(
      "@/composables/useActiveTrackWaveform"
    );
    const { waveformBins } = useActiveTrackWaveform();

    storeMock.curQueueItem = makeQueueItem({
      media_item: { item_id: "r-1", provider: "spotify", media_type: "radio" },
    });
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).not.toHaveBeenCalled();
    expect(waveformBins.value).toBeNull();
  });

  it("does not fetch when streamdetails are absent", async () => {
    const { useActiveTrackWaveform } = await import(
      "@/composables/useActiveTrackWaveform"
    );
    const { waveformBins } = useActiveTrackWaveform();

    storeMock.curQueueItem = makeQueueItem({ streamdetails: undefined });
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).not.toHaveBeenCalled();
    expect(waveformBins.value).toBeNull();
  });

  it("keeps waveformBins null when api throws", async () => {
    mockGetWaveForm.mockRejectedValueOnce(new Error("no analysis"));

    const { useActiveTrackWaveform } = await import(
      "@/composables/useActiveTrackWaveform"
    );
    const { waveformBins } = useActiveTrackWaveform();

    storeMock.curQueueItem = makeQueueItem();
    await nextTick();
    await nextTick();

    expect(waveformBins.value).toBeNull();
  });

  it("keeps waveformBins null when api returns empty array", async () => {
    mockGetWaveForm.mockResolvedValueOnce([]);

    const { useActiveTrackWaveform } = await import(
      "@/composables/useActiveTrackWaveform"
    );
    const { waveformBins } = useActiveTrackWaveform();

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

    const { useActiveTrackWaveform } = await import(
      "@/composables/useActiveTrackWaveform"
    );
    const { waveformBins } = useActiveTrackWaveform();

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

    const { useActiveTrackWaveform } = await import(
      "@/composables/useActiveTrackWaveform"
    );
    useActiveTrackWaveform();

    storeMock.curQueueItem = makeQueueItem({ queue_item_id: "qi-same" });
    await nextTick();
    await nextTick();

    storeMock.curQueueItem = { ...makeQueueItem({ queue_item_id: "qi-same" }) };
    await nextTick();
    await nextTick();

    expect(mockGetWaveForm).toHaveBeenCalledTimes(1);
  });
});
