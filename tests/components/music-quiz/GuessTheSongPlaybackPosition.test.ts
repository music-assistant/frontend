import { useGuessTheSongPlaybackPosition } from "@/components/music-quiz/game-types/guess-the-song/useGuessTheSongPlaybackPosition";
import { effectScope, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("useGuessTheSongPlaybackPosition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:20Z"));
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses server timestamps and clamps to the track duration", async () => {
    const active = ref(true);
    const scope = effectScope();
    const playback = scope.run(() =>
      useGuessTheSongPlaybackPosition({
        active,
        startedAt: Date.now() / 1000 - 20,
        duration: 10,
      }),
    );
    if (!playback) throw new Error("Failed to create playback clock");

    expect(playback.position.value).toBe(10);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    active.value = false;
    await nextTick();

    expect(playback.position.value).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    scope.stop();
  });

  it("does not start for a non-audio round", () => {
    const scope = effectScope();
    const playback = scope.run(() =>
      useGuessTheSongPlaybackPosition({
        active: false,
        startedAt: Date.now() / 1000,
        duration: 10,
      }),
    );
    if (!playback) throw new Error("Failed to create playback clock");

    expect(playback.position.value).toBe(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    scope.stop();
  });
});
