import { describe, expect, it } from "vitest";
import { FrameScheduler } from "./frameScheduler";

function frame(timestampUs: number): {
  timestampUs: number;
  samples: Uint8Array;
} {
  return { timestampUs, samples: new Uint8Array([timestampUs & 0xff]) };
}

describe("FrameScheduler", () => {
  it("returns null when no frame is due", () => {
    const scheduler = new FrameScheduler();
    scheduler.push(frame(1000));
    expect(scheduler.pickAt(999)).toBeNull();
  });

  it("picks the newest due frame and drops older ones", () => {
    const scheduler = new FrameScheduler();
    scheduler.push(frame(1000));
    scheduler.push(frame(2000));
    scheduler.push(frame(3000));
    const picked = scheduler.pickAt(2500);
    expect(picked!.timestampUs).toBe(2000);
    // 1000 dropped, 2000 kept as current, 3000 still queued
    expect(scheduler.size).toBe(2);
    expect(scheduler.pickAt(3000)!.timestampUs).toBe(3000);
  });

  it("keeps the picked frame available for re-picking", () => {
    const scheduler = new FrameScheduler();
    scheduler.push(frame(1000));
    expect(scheduler.pickAt(1500)!.timestampUs).toBe(1000);
    expect(scheduler.pickAt(1600)!.timestampUs).toBe(1000);
  });

  it("inserts out-of-order frames at the right position", () => {
    const scheduler = new FrameScheduler();
    scheduler.push(frame(1000));
    scheduler.push(frame(3000));
    scheduler.push(frame(2000));
    expect(scheduler.pickAt(2100)!.timestampUs).toBe(2000);
  });

  it("bounds the buffer to its capacity", () => {
    const scheduler = new FrameScheduler(3);
    for (let i = 1; i <= 10; i++) scheduler.push(frame(i * 1000));
    expect(scheduler.size).toBe(3);
    expect(scheduler.pickAt(20_000)!.timestampUs).toBe(10_000);
  });

  it("clears", () => {
    const scheduler = new FrameScheduler();
    scheduler.push(frame(1000));
    scheduler.clear();
    expect(scheduler.size).toBe(0);
    expect(scheduler.pickAt(5000)).toBeNull();
  });
});
