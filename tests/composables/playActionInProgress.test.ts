import { effectScope, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayActionInProgress } from "@/composables/playActionInProgress";
import type { PlayerQueue } from "@/plugins/api/interfaces";

// The composable only reads extra_attributes.play_action_in_progress.
const makeQueue = (inProgress: boolean) =>
  ({
    extra_attributes: { play_action_in_progress: inProgress },
  }) as unknown as PlayerQueue;

describe("usePlayActionInProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays false for a brief blip shorter than the debounce (the seek case)", async () => {
    const queue = ref<PlayerQueue | undefined>(makeQueue(false));
    const scope = effectScope();
    let result!: ReturnType<typeof usePlayActionInProgress>;
    scope.run(() => {
      result = usePlayActionInProgress(queue, 200);
    });

    queue.value = makeQueue(true);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(50);
    queue.value = makeQueue(false); // blip ends well before 200ms
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(200);

    expect(result.isLoading.value).toBe(false);
    scope.stop();
  });

  it("becomes true after the debounce when sustained", async () => {
    const queue = ref<PlayerQueue | undefined>(makeQueue(false));
    const scope = effectScope();
    let result!: ReturnType<typeof usePlayActionInProgress>;
    scope.run(() => {
      result = usePlayActionInProgress(queue, 200);
    });

    queue.value = makeQueue(true);
    await Promise.resolve();
    expect(result.isLoading.value).toBe(false); // not yet — still within the window

    await vi.advanceTimersByTimeAsync(200);
    expect(result.isLoading.value).toBe(true);
    scope.stop();
  });

  it("clears immediately when the flag goes false", async () => {
    const queue = ref<PlayerQueue | undefined>(makeQueue(true));
    const scope = effectScope();
    let result!: ReturnType<typeof usePlayActionInProgress>;
    scope.run(() => {
      result = usePlayActionInProgress(queue, 200);
    });

    await vi.advanceTimersByTimeAsync(200);
    expect(result.isLoading.value).toBe(true);

    queue.value = makeQueue(false);
    await Promise.resolve();
    expect(result.isLoading.value).toBe(false);
    scope.stop();
  });

  it("cancels a pending timer when the scope is disposed", async () => {
    const queue = ref<PlayerQueue | undefined>(makeQueue(false));
    const scope = effectScope();
    let result!: ReturnType<typeof usePlayActionInProgress>;
    scope.run(() => {
      result = usePlayActionInProgress(queue, 200);
    });

    queue.value = makeQueue(true);
    await Promise.resolve();
    scope.stop(); // onScopeDispose -> clearTimeout
    await vi.advanceTimersByTimeAsync(200);

    expect(result.isLoading.value).toBe(false);
  });
});
