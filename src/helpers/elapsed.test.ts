import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import computeElapsedTime from "./elapsed";
import { PlaybackState } from "../plugins/api/interfaces";

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
});
