import {
  effectScope,
  nextTick,
  reactive,
  ref,
  type EffectScope,
  type Ref,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackState } from "@/plugins/api/interfaces";

const { apiMock, serverNowMock } = vi.hoisted(() => ({
  apiMock: {
    queueElapsedTime: {} as Record<
      string,
      { elapsed_time?: number; elapsed_time_last_updated?: number }
    >,
  },
  serverNowMock: vi.fn<() => number>(),
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/composables/useServerTime", () => ({
  serverNow: serverNowMock,
}));

// Reactive so the composable's watchEffect reacts to mutations, mirroring
// the pattern used by the other composable tests in this directory.
const storeMock = reactive({
  activePlayerQueue: undefined as
    | { queue_id: string; state: PlaybackState; active: boolean }
    | undefined,
  activePlayer: undefined as { playback_state?: PlaybackState } | undefined,
  curQueueItem: undefined as
    | { extra_attributes?: { playback_speed?: number } }
    | undefined,
});

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

// ---------------------------------------------------------------------------
// Manual requestAnimationFrame driver
// ---------------------------------------------------------------------------
//
// Records scheduled callbacks by id instead of auto-recursing, so a test can
// flush exactly one frame and inspect how many frames are still pending.

let pendingFrames: Map<number, FrameRequestCallback>;
let nextRafId: number;

function flushFrame(): void {
  const callbacks = [...pendingFrames.values()];
  pendingFrames.clear();
  for (const callback of callbacks) callback(0);
}

const NOW = 1_700_000_000;

function makeQueue(overrides: Record<string, unknown> = {}) {
  return {
    queue_id: "q1",
    state: PlaybackState.PLAYING,
    active: true,
    ...overrides,
  };
}

// Disposed in afterEach so a failed assertion cannot leave an effect
// subscribed to the shared store mock and corrupt the tests that follow.
let activeScope: EffectScope | undefined;

async function runComposable(enabled?: Ref<boolean>) {
  const { useLyricsElapsedTime } =
    await import("@/composables/lyrics/useLyricsElapsedTime");
  activeScope = effectScope();
  const composable = activeScope.run(() => useLyricsElapsedTime(enabled));
  if (!composable) throw new Error("useLyricsElapsedTime did not run");
  return { ...composable, scope: activeScope };
}

describe("useLyricsElapsedTime", () => {
  beforeEach(() => {
    activeScope = undefined;
    pendingFrames = new Map();
    nextRafId = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const id = ++nextRafId;
        pendingFrames.set(id, callback);
        return id;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        pendingFrames.delete(id);
      }),
    );

    apiMock.queueElapsedTime = {};
    storeMock.activePlayerQueue = undefined;
    storeMock.activePlayer = undefined;
    storeMock.curQueueItem = undefined;
    serverNowMock.mockReset();
    serverNowMock.mockReturnValue(NOW);
  });

  afterEach(() => {
    activeScope?.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads a frozen position from a paused queue even while the loop runs", async () => {
    storeMock.activePlayerQueue = makeQueue({ state: PlaybackState.PAUSED });
    storeMock.activePlayer = { playback_state: PlaybackState.PLAYING };
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 42,
      elapsed_time_last_updated: NOW,
    };

    const { elapsedTime, start } = await runComposable();
    await nextTick();
    expect(pendingFrames.size).toBe(0);

    // Drive the loop by hand to prove the position itself is frozen rather
    // than merely unpolled.
    start();
    flushFrame();
    expect(elapsedTime.value).toBe(42);

    serverNowMock.mockReturnValue(NOW + 50);
    flushFrame();
    expect(elapsedTime.value).toBe(42);
  });

  it("advances the position as serverNow advances while the queue plays", async () => {
    storeMock.activePlayerQueue = makeQueue();
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };

    const { elapsedTime } = await runComposable();
    await nextTick();
    flushFrame();
    expect(elapsedTime.value).toBe(10);

    serverNowMock.mockReturnValue(NOW + 5);
    flushFrame();
    expect(elapsedTime.value).toBe(15);
  });

  it("runs the loop from the queue's state even when the player disagrees", async () => {
    storeMock.activePlayerQueue = makeQueue({ state: PlaybackState.PLAYING });
    storeMock.activePlayer = { playback_state: PlaybackState.PAUSED };

    await runComposable();
    await nextTick();

    expect(pendingFrames.size).toBe(1);
  });

  it("stops the loop when the queue pauses even though the player keeps playing", async () => {
    storeMock.activePlayerQueue = makeQueue({ state: PlaybackState.PLAYING });
    storeMock.activePlayer = { playback_state: PlaybackState.PLAYING };

    await runComposable();
    await nextTick();
    expect(pendingFrames.size).toBe(1);

    storeMock.activePlayerQueue = makeQueue({ state: PlaybackState.PAUSED });
    await nextTick();

    expect(pendingFrames.size).toBe(0);
  });

  it("stops the loop when the queue becomes inactive", async () => {
    storeMock.activePlayerQueue = makeQueue({ active: true });

    await runComposable();
    await nextTick();
    expect(pendingFrames.size).toBe(1);

    storeMock.activePlayerQueue = makeQueue({ active: false });
    await nextTick();

    expect(pendingFrames.size).toBe(0);
  });

  it("stops the loop when the enabled ref flips to false", async () => {
    storeMock.activePlayerQueue = makeQueue();
    const enabled = ref(true);

    await runComposable(enabled);
    await nextTick();
    expect(pendingFrames.size).toBe(1);

    enabled.value = false;
    await nextTick();

    expect(pendingFrames.size).toBe(0);
  });

  it("stops the loop and removes the visibilitychange listener when the scope is disposed", async () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    storeMock.activePlayerQueue = makeQueue();

    const { scope } = await runComposable();
    await nextTick();
    expect(pendingFrames.size).toBe(1);

    scope.stop();

    expect(pendingFrames.size).toBe(0);
    const [, visibilityHandler] = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === "visibilitychange",
    )!;
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      visibilityHandler,
    );
  });
});
