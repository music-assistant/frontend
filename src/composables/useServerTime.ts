/**
 * Server time.
 *
 * The server hands out absolute UTC timestamps (`elapsed_time_last_updated`,
 * `auto_advance_at`, `audio_started_at`, ...) that a client turns into a position or a
 * countdown by comparing them against its own clock. That comparison is only as good as
 * the two clocks agree: a device (or server) whose clock is off by N seconds renders
 * playback progress and quiz countdowns N seconds wrong, with no upper bound on N.
 *
 * `serverNow()` returns the current time on the *server's* clock, so those comparisons
 * stay correct no matter which of the two clocks is off. Use it instead of
 * `Date.now() / 1000` whenever the other operand is a server timestamp.
 *
 * The estimate comes from SNTP-style round trips of the `time` command: the server's
 * reading is assumed to be taken halfway between sending the probe and receiving the
 * reply, which makes the residual error half the round-trip time. Probes are sent in
 * bursts and the fastest round trip of a burst wins, so a single slow reply cannot skew
 * the result; the estimate is published from the first sample on and refined from there.
 *
 * The anchor is kept against `performance.now()` rather than `Date.now()`, so the
 * estimate survives the device stepping its own clock (an NTP correction landing
 * mid-playback) without the rendered position jumping.
 */
import { computed, readonly, ref } from "vue";

/** Probes the server clock, resolving with its UTC timestamp in seconds. */
export type ServerTimeProbe = () => Promise<number>;

// Probes per burst. The first burst is larger because nothing is known yet; refreshes
// only need enough samples to discard a transient network hiccup.
const INITIAL_BURST_SIZE = 5;
const REFRESH_BURST_SIZE = 3;
const BURST_PROBE_SPACING_MS = 200;
const REFRESH_INTERVAL_MS = 60_000;

interface ServerTimeAnchor {
  /** `performance.now()` reading the server timestamp is attributed to. */
  perfMs: number;
  /** Server clock reading (UTC seconds) at `perfMs`. */
  serverSeconds: number;
  /** Half the round trip of the accepted sample: the residual error of this anchor. */
  uncertaintySeconds: number;
}

const anchor = ref<ServerTimeAnchor | undefined>();
const supported = ref(true);
let probe: ServerTimeProbe | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let burstInFlight = false;

/**
 * The current time on the server's clock, as a UTC timestamp in seconds.
 *
 * Falls back to the device clock while no estimate is available (before the first
 * successful probe, or against a server that predates the `time` command).
 */
export function serverNow(): number {
  const current = anchor.value;
  if (!current) return Date.now() / 1000;
  return current.serverSeconds + (performance.now() - current.perfMs) / 1000;
}

/**
 * Start estimating the offset between the server clock and this device's clock.
 *
 * Safe to call again on every (re)connect: an in-flight burst is not duplicated and the
 * previous estimate is kept until a new sample replaces it.
 */
export function startServerTimeSync(newProbe: ServerTimeProbe): void {
  probe = newProbe;
  supported.value = true;
  if (refreshTimer === undefined) {
    refreshTimer = setInterval(
      () => void runBurst(REFRESH_BURST_SIZE),
      REFRESH_INTERVAL_MS,
    );
  }
  registerVisibilityListeners();
  void runBurst(anchor.value ? REFRESH_BURST_SIZE : INITIAL_BURST_SIZE);
}

/**
 * Stop probing, keeping the last estimate.
 *
 * Used while the connection is down: a slightly stale offset still beats no correction,
 * and clock offsets do not meaningfully change over a reconnect.
 */
export function stopServerTimeSync(): void {
  probe = undefined;
  if (refreshTimer !== undefined) clearInterval(refreshTimer);
  refreshTimer = undefined;
  unregisterVisibilityListeners();
}

/**
 * Drop the estimate and stop probing.
 *
 * Used when the connection cannot provide one (a server without the `time` command) or
 * when connecting to a different server, whose clock offset is unrelated.
 */
export function resetServerTime(supportedByServer = true): void {
  stopServerTimeSync();
  anchor.value = undefined;
  supported.value = supportedByServer;
}

/** Reactive view of the offset estimate, for diagnostics. */
export function useServerTime() {
  return {
    serverNow,
    /** Server clock minus device clock, in seconds. Positive: device is behind. */
    offsetSeconds: computed(() =>
      anchor.value ? serverNow() - Date.now() / 1000 : null,
    ),
    /** Residual error of the current estimate (half the accepted round trip). */
    uncertaintySeconds: computed(
      () => anchor.value?.uncertaintySeconds ?? null,
    ),
    isSynced: computed(() => anchor.value !== undefined),
    /** Whether the connected server can report its clock at all. */
    isSupported: readonly(supported),
  };
}

async function runBurst(size: number): Promise<void> {
  if (burstInFlight || !probe) return;
  burstInFlight = true;
  try {
    let best: ServerTimeAnchor | undefined;
    for (let index = 0; index < size; index++) {
      if (index > 0) await delay(BURST_PROBE_SPACING_MS);
      // read after the delay: sync may have stopped while this burst was waiting
      const currentProbe = probe;
      if (!currentProbe) break;
      const sample = await takeSample(currentProbe);
      if (!sample) continue;
      if (!best || sample.uncertaintySeconds < best.uncertaintySeconds) {
        // publish as the burst goes: the first sample already beats no correction, and
        // each faster round trip refines it, so nothing waits for the burst to finish
        best = sample;
        anchor.value = sample;
      }
    }
  } finally {
    burstInFlight = false;
  }
}

async function takeSample(
  currentProbe: ServerTimeProbe,
): Promise<ServerTimeAnchor | undefined> {
  const sentAt = performance.now();
  let serverSeconds: number;
  try {
    serverSeconds = await currentProbe();
  } catch {
    // Best-effort: a failed probe leaves the previous estimate in place.
    return undefined;
  }
  const receivedAt = performance.now();
  if (typeof serverSeconds !== "number" || !Number.isFinite(serverSeconds)) {
    return undefined;
  }
  return {
    // The server read its clock somewhere between sending and receiving; the midpoint
    // is the best estimate, and is off by at most half the round trip.
    perfMs: (sentAt + receivedAt) / 2,
    serverSeconds,
    uncertaintySeconds: (receivedAt - sentAt) / 2000,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A device that was asleep may have resynced (or stepped) its own clock while the page
// was hidden, and background timers are throttled, so resample as soon as it is back.
function handleVisibilityChange() {
  if (document.visibilityState === "visible") void runBurst(REFRESH_BURST_SIZE);
}

function handleFocus() {
  void runBurst(REFRESH_BURST_SIZE);
}

let visibilityListenersRegistered = false;

function registerVisibilityListeners() {
  if (visibilityListenersRegistered || typeof document === "undefined") return;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  visibilityListenersRegistered = true;
}

function unregisterVisibilityListeners() {
  if (!visibilityListenersRegistered) return;
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", handleFocus);
  visibilityListenersRegistered = false;
}
