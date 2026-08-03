import {
  resetServerTime,
  serverNow,
  startServerTimeSync,
  useServerTime,
} from "@/composables/useServerTime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BURST_SPACING_MS = 200;
const INITIAL_BURST_SIZE = 5;
const REFRESH_INTERVAL_MS = 60_000;

// The device clock runs 30 seconds ahead of the server's in these tests.
const DEVICE_NOW_MS = Date.parse("2026-01-01T00:00:30Z");
const DEVICE_CLOCK_ERROR_SECONDS = 30;

describe("useServerTime", () => {
  let perfNow: number;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DEVICE_NOW_MS);
    perfNow = 1000;
    // vitest does not fake performance.now(), which the offset estimate is anchored on
    vi.spyOn(performance, "now").mockImplementation(() => perfNow);
  });

  afterEach(() => {
    resetServerTime();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("falls back to the device clock until a sample lands", () => {
    expect(serverNow()).toBeCloseTo(DEVICE_NOW_MS / 1000, 6);
    expect(useServerTime().isSynced.value).toBe(false);
    expect(useServerTime().offsetSeconds.value).toBeNull();
  });

  it("anchors on the fastest round trip of the burst", async () => {
    // round trips in ms per probe; the 40ms one should win
    const roundTrips = [500, 300, 40, 260, 700];
    const probe = vi.fn(() => {
      const roundTrip = roundTrips[probe.mock.calls.length - 1];
      // the server read its clock halfway through the round trip
      const serverSeconds = serverClockNow() + roundTrip / 2000;
      spendTime(roundTrip);
      return Promise.resolve(serverSeconds);
    });

    startServerTimeSync(probe);
    // the first sample already corrects the clock; the burst only refines it
    await advanceTime(0);
    expect(useServerTime().isSynced.value).toBe(true);
    expect(useServerTime().uncertaintySeconds.value).toBeCloseTo(0.25, 6);

    await flushBurst(INITIAL_BURST_SIZE);

    const { offsetSeconds, uncertaintySeconds, isSynced } = useServerTime();
    expect(probe).toHaveBeenCalledTimes(INITIAL_BURST_SIZE);
    expect(isSynced.value).toBe(true);
    // uncertainty is half of the accepted round trip
    expect(uncertaintySeconds.value).toBeCloseTo(0.02, 6);
    // the device clock runs ahead, so the correction is negative
    expect(offsetSeconds.value).toBeCloseTo(-DEVICE_CLOCK_ERROR_SECONDS, 3);
  });

  it("advances with the monotonic clock, not the device clock", async () => {
    startServerTimeSync(() => Promise.resolve(serverClockNow()));
    await flushBurst(INITIAL_BURST_SIZE);

    const before = serverNow();
    // the device steps its own clock (an NTP correction landing mid-playback)
    vi.setSystemTime(DEVICE_NOW_MS + 3_600_000);
    perfNow += 5000;

    expect(serverNow() - before).toBeCloseTo(5, 6);
  });

  it("keeps the previous estimate when probes start failing", async () => {
    let failing = false;
    startServerTimeSync(() =>
      failing
        ? Promise.reject(new Error("Connection lost"))
        : Promise.resolve(serverClockNow()),
    );
    await flushBurst(INITIAL_BURST_SIZE);
    const estimate = useServerTime().offsetSeconds.value;

    failing = true;
    await advanceTime(REFRESH_INTERVAL_MS);
    await flushBurst(INITIAL_BURST_SIZE);

    expect(useServerTime().isSynced.value).toBe(true);
    expect(useServerTime().offsetSeconds.value).toBeCloseTo(estimate!, 6);
  });

  it("stops probing and drops the estimate on reset", async () => {
    const probe = vi.fn(() => Promise.resolve(serverClockNow()));
    startServerTimeSync(probe);
    await flushBurst(INITIAL_BURST_SIZE);
    expect(useServerTime().isSynced.value).toBe(true);

    resetServerTime(false);
    const callsAfterReset = probe.mock.calls.length;
    await advanceTime(REFRESH_INTERVAL_MS * 2);

    expect(probe).toHaveBeenCalledTimes(callsAfterReset);
    expect(useServerTime().isSynced.value).toBe(false);
    expect(useServerTime().isSupported.value).toBe(false);
    expect(serverNow()).toBeCloseTo(Date.now() / 1000, 6);
  });

  /** The server's clock, which this device's clock runs ahead of. */
  function serverClockNow() {
    return Date.now() / 1000 - DEVICE_CLOCK_ERROR_SECONDS;
  }

  /** Burn wall-clock time without waiting on a timer (a round trip in flight). */
  function spendTime(ms: number) {
    perfNow += ms;
    vi.setSystemTime(Date.now() + ms);
  }

  /** Advance time, keeping the monotonic and device clocks in step. */
  async function advanceTime(ms: number) {
    perfNow += ms;
    await vi.advanceTimersByTimeAsync(ms);
  }

  /** Let a burst run to completion: each probe after the first waits out the spacing. */
  async function flushBurst(size: number) {
    for (let index = 0; index < size; index++) {
      await advanceTime(BURST_SPACING_MS);
    }
  }
});
