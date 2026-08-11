import { describe, expect, it } from "vitest";
import { ClockSync, computeTimeSample } from "./timeSync";

describe("computeTimeSample", () => {
  it("computes offset and delay from NTP timestamps", () => {
    // Client clock is 1_000_000 µs behind the server; 1000 µs travel each way.
    const t1 = 10_000;
    const t2 = 1_011_000; // server received after 1000 µs travel
    const t3 = 1_011_500; // server processing 500 µs
    const t4 = 12_500; // client receives after another 1000 µs travel
    const sample = computeTimeSample(t1, t2, t3, t4);
    expect(sample.offsetUs).toBe(1_000_000);
    expect(sample.delayUs).toBe(1_000);
  });

  it("computes zero offset for synchronized clocks", () => {
    const sample = computeTimeSample(0, 100, 100, 200);
    expect(sample.offsetUs).toBe(0);
    expect(sample.delayUs).toBe(100);
  });
});

describe("ClockSync", () => {
  it("is unsynchronized before the first sample", () => {
    const sync = new ClockSync();
    expect(sync.synchronized).toBe(false);
    expect(sync.offsetUs).toBeNull();
  });

  it("prefers the lowest-delay sample", () => {
    const sync = new ClockSync();
    sync.addSample({ offsetUs: 5000, delayUs: 900 });
    sync.addSample({ offsetUs: 5100, delayUs: 100 });
    sync.addSample({ offsetUs: 4000, delayUs: 700 });
    expect(sync.offsetUs).toBe(5100);
  });

  it("slides the sample window", () => {
    const sync = new ClockSync(2);
    sync.addSample({ offsetUs: 1, delayUs: 1 });
    sync.addSample({ offsetUs: 2, delayUs: 50 });
    sync.addSample({ offsetUs: 3, delayUs: 60 });
    // The delay-1 sample fell out of the window.
    expect(sync.offsetUs).toBe(2);
  });

  it("clears", () => {
    const sync = new ClockSync();
    sync.addSample({ offsetUs: 1, delayUs: 1 });
    sync.clear();
    expect(sync.offsetUs).toBeNull();
  });
});
