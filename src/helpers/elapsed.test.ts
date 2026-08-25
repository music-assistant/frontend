import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeElapsedTime, queueItemPlaybackSpeed } from "./elapsed";
import { PlaybackState, QueueItem } from "../plugins/api/interfaces";

describe("computeElapsedTime", () => {
  const REAL_DATE_NOW = Date.now;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-ignore
    Date.now = REAL_DATE_NOW;
  });

  it("returns undefined when elapsed_time undefined", () => {
    expect(computeElapsedTime(undefined, undefined)).toBeUndefined();
  });

  it("returns same value when playback is paused", () => {
    const t0 = 1000; // seconds
    const ts = 1600000000; // seconds
    expect(computeElapsedTime(t0, ts, PlaybackState.PAUSED)).toBe(t0);
  });

  it("advances elapsed when playing using timestamp difference", () => {
    const t0 = 10; // seconds
    const ts = 1_600_000_000; // seconds
    // move time forward by 5.5 seconds
    vi.setSystemTime(ts * 1000 + 5500);

    const result = computeElapsedTime(t0, ts, PlaybackState.PLAYING);
    // allow small float delta
    expect(result).toBeGreaterThanOrEqual(15.499);
    expect(result).toBeLessThanOrEqual(15.501);
  });

  it("handles elapsed_time_last_updated provided in seconds (not ms)", () => {
    const t0 = 30; // seconds
    const ts_seconds = 1_600_000_000; // seconds
    // set now to ts_seconds + 2.5 seconds
    vi.setSystemTime(ts_seconds * 1000 + 2500);

    const result = computeElapsedTime(t0, ts_seconds, PlaybackState.PLAYING);
    expect(result).toBeGreaterThanOrEqual(32.499);
    expect(result).toBeLessThanOrEqual(32.501);
  });

  it("handles elapsed_time provided in milliseconds (not seconds)", () => {
    // server sends seconds; elapsed_time in seconds
    const t0 = 30; // seconds
    const ts = 1_600_000_000; // seconds
    vi.setSystemTime(ts * 1000 + 1000);

    const result = computeElapsedTime(t0, ts, PlaybackState.PLAYING);
    expect(result).toBeGreaterThanOrEqual(31.0 - 0.001);
    expect(result).toBeLessThanOrEqual(31.0 + 0.001);
  });

  it("scales the delta by playback_speed > 1", () => {
    const t0 = 10;
    const ts = 1_600_000_000;
    vi.setSystemTime(ts * 1000 + 4000); // 4s wall-clock

    const result = computeElapsedTime(t0, ts, PlaybackState.PLAYING, 1.5);
    // 10 + 4 * 1.5 = 16
    expect(result).toBeGreaterThanOrEqual(15.999);
    expect(result).toBeLessThanOrEqual(16.001);
  });

  it("scales the delta by playback_speed < 1", () => {
    const t0 = 10;
    const ts = 1_600_000_000;
    vi.setSystemTime(ts * 1000 + 4000); // 4s wall-clock

    const result = computeElapsedTime(t0, ts, PlaybackState.PLAYING, 0.5);
    // 10 + 4 * 0.5 = 12
    expect(result).toBeGreaterThanOrEqual(11.999);
    expect(result).toBeLessThanOrEqual(12.001);
  });

  it("defaults playback_speed to 1 when omitted", () => {
    const t0 = 10;
    const ts = 1_600_000_000;
    vi.setSystemTime(ts * 1000 + 2000);

    const result = computeElapsedTime(t0, ts, PlaybackState.PLAYING);
    expect(result).toBeGreaterThanOrEqual(11.999);
    expect(result).toBeLessThanOrEqual(12.001);
  });
});

describe("queueItemPlaybackSpeed", () => {
  const itemWithSpeed = (playback_speed?: unknown) =>
    ({
      extra_attributes: { playback_speed },
    }) as QueueItem;

  it.each([
    ["a speed above 1", 1.5, 1.5],
    ["a speed below 1", 0.75, 0.75],
    ["an explicit normal speed", 1, 1],
  ])("returns %s as-is", (_label, playback_speed, expected) => {
    expect(queueItemPlaybackSpeed(itemWithSpeed(playback_speed))).toBe(
      expected,
    );
  });

  it.each([
    ["zero", 0],
    ["a negative speed", -1],
    ["infinity", Number.POSITIVE_INFINITY],
    ["NaN", Number.NaN],
    ["a non-numeric value", "1.5"],
    ["null", null],
    ["an absent speed", undefined],
  ])("falls back to normal speed for %s", (_label, playback_speed) => {
    expect(queueItemPlaybackSpeed(itemWithSpeed(playback_speed))).toBe(1);
  });

  it("falls back to normal speed without extra_attributes or item", () => {
    expect(queueItemPlaybackSpeed({} as QueueItem)).toBe(1);
    expect(queueItemPlaybackSpeed(undefined)).toBe(1);
  });
});
