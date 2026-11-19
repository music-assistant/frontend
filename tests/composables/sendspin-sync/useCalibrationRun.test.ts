import { useCalibrationRun } from "@/composables/sendspin-sync/useCalibrationRun";
import type { Recording } from "@/composables/sendspin-sync/useChirpCapture";
import {
  chirpPhase,
  CHIRP_PERIOD_SECONDS,
  CHIRP_SECONDS,
} from "@/helpers/sendspin-sync/chirp";
import { BRACKET_LIMIT_MS } from "@/helpers/sendspin-sync/verdict";
import { effectScope, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RATE = 48000;
const CHIRP_LENGTH = Math.round(CHIRP_SECONDS * RATE);

/** As long as the run records for one speaker: seven chirps, wherever they land. */
const RECORD_SECONDS = 8 * CHIRP_PERIOD_SECONDS;

/** Chirps a recording that long is sure to hold. */
const CHIRPS_HELD = 7;

const fakes = vi.hoisted(() => ({
  session: {
    loadPlayers: vi.fn(),
    refresh: vi.fn(),
    start: vi.fn(),
    solo: vi.fn(),
    apply: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
  },
  capture: {
    open: vi.fn(),
    record: vi.fn(),
    reset: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock("@/composables/sendspin-sync/useCalibrationSession", async () => {
  const { ref: vueRef } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useCalibrationSession: () => ({
      players: vueRef([
        {
          player_id: "living",
          name: "Living room",
          busy: false,
          adjustable: true,
          silent: false,
        },
        {
          player_id: "kitchen",
          name: "Kitchen",
          busy: false,
          adjustable: true,
          silent: false,
        },
      ]),
      state: vueRef(null),
      lost: sessionLost,
      problem: vueRef(null),
      owned: vueRef(false),
      busy: vueRef(false),
      ...fakes.session,
    }),
  };
});

vi.mock("@/composables/sendspin-sync/useChirpCapture", async () => {
  const { ref: vueRef } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useChirpCapture: () => ({
      opened: vueRef(true),
      recording: vueRef(false),
      voided,
      sampleRate: vueRef(RATE),
      contextStates: vueRef([]),
      ...fakes.capture,
    }),
  };
});

let voided = ref<"suspended" | null>(null);
let sessionLost = ref<"expired" | null>(null);
let scopes: ReturnType<typeof effectScope>[] = [];

function withScope<T>(factory: () => T): T {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(factory)!;
}

/**
 * A recording of one speaker, placed on the phone's own audio clock.
 *
 * The arrival times satisfy the model the fit has to undo: a chirp emitted on the
 * server's metronome lands at `(n * period + offset) / (1 - drift)` on the phone's
 * clock. Building the audio itself rather than the arrival times means the real
 * detector and the real fit both run here.
 *
 * `spacingSeconds` is the rate the server emitted at, which is the period this
 * build expects unless a case is about the two disagreeing.
 */
function recordingAt(options: {
  startSeconds: number;
  offsetSeconds: number;
  drift: number;
  seconds?: number;
  spacingSeconds?: number;
}): Recording {
  const { startSeconds, offsetSeconds, drift } = options;
  const spacing = options.spacingSeconds ?? CHIRP_PERIOD_SECONDS;
  const length = Math.round((options.seconds ?? RECORD_SECONDS) * RATE);
  const samples = new Float32Array(length);
  const firstFrame = Math.round(startSeconds * RATE);

  const first = Math.ceil(
    (startSeconds * (1 - drift) - offsetSeconds) / spacing,
  );
  for (let chirp = first; ; chirp++) {
    const at = (chirp * spacing + offsetSeconds) / (1 - drift);
    const index = at * RATE - firstFrame;
    if (index >= length) break;
    if (index >= 0) placeChirp(samples, index);
  }

  // `Math.imul`, because the spacing measurement reads how much a recording
  // repeats: a 31-bit product rounded through a double loses its low bits and
  // comes back periodic, which is a chirp train as far as that is concerned.
  let state = 5;
  for (let index = 0; index < length; index++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    samples[index] += (state / 4294967296 - 0.5) * 0.01;
  }
  return { samples, firstFrame, sampleRate: RATE, dropouts: 0, lostFrames: 0 };
}

function placeChirp(buffer: Float32Array, at: number): void {
  for (let index = Math.max(0, Math.ceil(at)); index < buffer.length; index++) {
    const progress = (index - at) / CHIRP_LENGTH;
    if (progress >= 1) break;
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * progress));
    buffer[index] += 0.5 * window * Math.sin(chirpPhase(progress));
  }
}

/** Drive one measurement past the settling wait. */
async function measure(
  run: ReturnType<typeof useCalibrationRun>,
  playerId: string,
  replace = false,
): Promise<boolean> {
  const pending = run.measure(playerId, replace);
  await vi.advanceTimersByTimeAsync(1000);
  return await pending;
}

async function started() {
  const run = withScope(() => useCalibrationRun());
  run.selected.value = ["living", "kitchen"];
  expect(await run.begin()).toBe(true);
  return run;
}

beforeEach(() => {
  scopes = [];
  voided = ref(null);
  sessionLost = ref(null);
  vi.useFakeTimers();

  for (const fake of [
    ...Object.values(fakes.session),
    ...Object.values(fakes.capture),
  ])
    fake.mockReset();

  fakes.capture.open.mockResolvedValue({
    opened: true,
    sampleRate: RATE,
    constraints: null,
    wakeLock: null,
    error: null,
  });
  fakes.capture.record.mockResolvedValue(null);
  fakes.capture.close.mockResolvedValue(undefined);
  fakes.session.start.mockResolvedValue(true);
  fakes.session.solo.mockResolvedValue(true);
  fakes.session.stop.mockResolvedValue(undefined);
  fakes.session.apply.mockResolvedValue({
    applied: { living: 12 },
    previous: { living: 0 },
    manual: { kitchen: 0 },
  });
});

afterEach(() => {
  for (const scope of scopes) scope.stop();
  vi.useRealTimers();
});

describe("useCalibrationRun", () => {
  it("will not start against fewer than two speakers", async () => {
    const run = withScope(() => useCalibrationRun());
    run.selected.value = ["living"];

    expect(await run.begin()).toBe(false);
    expect(fakes.capture.open).not.toHaveBeenCalled();
  });

  it("opens the microphone before taking the speakers over", async () => {
    const run = await started();

    // The microphone is what the whole run depends on, and a refusal after the
    // speakers were commandeered would leave them muted for nothing.
    expect(fakes.capture.open.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.session.start.mock.invocationCallOrder[0],
    );
    expect(run.phase.value).toBe("walking");
  });

  it("gives the speakers back when the microphone was refused", async () => {
    fakes.capture.open.mockResolvedValue({
      opened: false,
      sampleRate: null,
      constraints: null,
      wakeLock: null,
      error: { name: "NotAllowedError", message: "Denied" },
    });
    const run = withScope(() => useCalibrationRun());
    run.selected.value = ["living", "kitchen"];

    expect(await run.begin()).toBe(false);
    expect(run.openError.value).toBe("NotAllowedError");
    expect(fakes.session.start).not.toHaveBeenCalled();
  });

  it("solos a speaker and lets it settle before recording", async () => {
    const run = await started();
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );

    await measure(run, "living");

    expect(fakes.session.solo).toHaveBeenCalledWith("living");
    // The server unmutes the target and then mutes the others, so the first chirp
    // periods after a solo still carry the speaker that was audible before.
    expect(fakes.session.solo.mock.invocationCallOrder[0]).toBeLessThan(
      fakes.capture.record.mock.invocationCallOrder[0],
    );
    expect(run.visits.value).toHaveLength(1);
    expect(run.visits.value[0].found).toBeGreaterThanOrEqual(CHIRPS_HELD);
  });

  it("asks for the first speaker again once the rest are done", async () => {
    const run = await started();
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );

    await measure(run, "living");
    expect(run.needsBracket.value).toBe(false);
    expect(run.remaining.value).toEqual(["kitchen"]);

    await measure(run, "kitchen");
    expect(run.remaining.value).toEqual([]);
    expect(run.needsBracket.value).toBe(true);
  });

  it("anchors on the speaker that was actually measured first", async () => {
    const run = await started();
    expect(run.anchor.value).toBeNull();

    // Ticked second, walked first. The fit fixes the offset of whichever speaker
    // it heard first at zero, so that is the speaker the repeat has to be asked
    // of — the order the speakers were ticked in says nothing about it.
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );
    await measure(run, "kitchen");
    expect(run.anchor.value).toBe("kitchen");

    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 30, offsetSeconds: 0.012, drift: 0 }),
    );
    await measure(run, "living");

    expect(run.anchor.value).toBe("kitchen");
    expect(run.fit.value!.offsetsMs.kitchen).toBeCloseTo(0, 6);
    expect(run.fit.value!.offsetsMs.living).toBeCloseTo(12, 1);
  });

  it("invites one more repeat while the clock rate is pinned but untested", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }

    expect(run.needsBracket.value).toBe(false);
    expect(run.verdict.value).toBe("pinned");
    expect(run.needsCheck.value).toBe(true);

    // A second speaker read twice is the constraint the clock rate cannot absorb,
    // so from here the run tests the rate rather than merely resting on it.
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 90, offsetSeconds: 0.012, drift: 0 }),
    );
    await measure(run, "kitchen");

    expect(run.verdict.value).toBe("checked");
    expect(run.needsCheck.value).toBe(false);
  });

  it("recovers the speaker latencies from a real walk", async () => {
    const run = await started();
    const drift = 60e-6;

    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(recordingAt({ ...visit, drift }));
      expect(await measure(run, visit.player)).toBe(true);
    }

    const fit = run.fit.value!;
    expect(fit.offsetsMs.living).toBeCloseTo(0, 6);
    expect(fit.offsetsMs.kitchen).toBeCloseTo(12, 1);
    expect(fit.rateErrorPpm).toBeCloseTo(60, 0);
    expect(fit.bracketSpanSeconds).toBeGreaterThan(50);
    expect(fit.residualMs).toBeLessThan(0.1);
    expect(run.trustworthy.value).toBe(true);
    // One repeated speaker sets the clock rate; it cannot also test it.
    expect(fit.bracketResidualMs).toBeNull();
    expect(run.verdict.value).toBe("pinned");
  });

  it("refuses to apply a run whose recording had holes in it", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
    ]) {
      const recording = recordingAt({ ...visit, drift: 0 });
      // Only the middle reading, so the run-wide totals stay modest and it is the
      // worst single recording that decides.
      if (visit.player === "kitchen") {
        recording.dropouts = 96;
        recording.lostFrames = 96 * 128;
      }
      fakes.capture.record.mockResolvedValue(recording);
      await measure(run, visit.player);
    }

    expect(run.loss.value.dropouts).toBe(96);
    expect(run.loss.value.worstFraction).toBeCloseTo(0.032, 3);
    // Otherwise a clean-looking run: the fit has nothing to complain about, which
    // is exactly why the recording has to be judged separately from it.
    expect(run.verdict.value).toBe("lossy");
    expect(run.trustworthy.value).toBe(false);
    expect(await run.apply()).toBe(false);
    expect(fakes.session.apply).not.toHaveBeenCalled();
  });

  it("refuses a run whose server is emitting at a rate this build does not expect", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        // A server still on the old half-second rate. Nothing else about the walk
        // is wrong, and the recordings look healthy: the windows the detector
        // searches land on every other chirp and each one holds an arrival.
        recordingAt({
          ...visit,
          drift: 0,
          spacingSeconds: CHIRP_PERIOD_SECONDS / 2,
        }),
      );
      await measure(run, visit.player);
    }

    for (const reading of run.visits.value) {
      expect(reading.found).toBeGreaterThanOrEqual(CHIRPS_HELD);
      expect(reading.spacingSeconds!).toBeCloseTo(CHIRP_PERIOD_SECONDS / 2, 2);
    }
    expect(run.spacingSeconds.value!).toBeCloseTo(CHIRP_PERIOD_SECONDS / 2, 2);

    // The fit itself has nothing to complain about — which is exactly why the
    // spacing has to be checked separately from it.
    expect(run.verdict.value).toBe("mismatched");
    expect(run.trustworthy.value).toBe(false);
    expect(await run.apply()).toBe(false);
    expect(fakes.session.apply).not.toHaveBeenCalled();
  });

  it("holds nothing against a run that heard everything", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }

    // Thirty seconds between speakers each time, and none of it counted: the
    // silences a walk is made of are free, and saying otherwise here would be a
    // reason to hurry that the measurement does not have.
    expect(run.loss.value).toEqual({ dropouts: 0, worstFraction: 0 });
    expect(run.trustworthy.value).toBe(true);
  });

  it("refuses to apply a run that was never bracketed", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }

    // Without a second reading of one speaker there is nothing separating the
    // phone's clock drift from the latencies being measured.
    expect(run.fit.value!.bracketSpanSeconds).toBeNull();
    expect(run.verdict.value).toBe("unbracketed");
    expect(run.trustworthy.value).toBe(false);
    expect(await run.apply()).toBe(false);
    expect(fakes.session.apply).not.toHaveBeenCalled();
  });

  it("refuses to apply a run whose repeated readings disagree", async () => {
    const run = await started();
    run.selected.value = ["living", "kitchen"];
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
      // Kitchen read 5 ms further out than it did the first time. With two
      // speakers repeated there is one constraint more than the clock rate can
      // absorb, so this finally shows up instead of vanishing into the rate.
      { startSeconds: 90, offsetSeconds: 0.017, player: "kitchen" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }

    expect(run.verdict.value).toBe("disagrees");
    expect(run.fit.value!.bracketResidualMs!).toBeGreaterThan(BRACKET_LIMIT_MS);
    expect(run.trustworthy.value).toBe(false);
    expect(await run.apply()).toBe(false);
  });

  it("cannot detect a repeat that shifted linearly, and does not pretend to", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      // The anchor reading 6 ms further out than at the start. With only this one
      // repeat the fit absorbs it into the clock rate — 6 ms across the 60 seconds
      // between the two readings, so 100 ppm, entirely ordinary for a phone — and
      // kitchen comes out 3 ms wrong.
      { startSeconds: 60, offsetSeconds: 0.006, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }

    const fit = run.fit.value!;
    expect(Math.abs(fit.rateErrorPpm - 100)).toBeLessThan(2);
    expect(fit.offsetsMs.kitchen).toBeCloseTo(9, 0);
    // So no disagreement is reported, because there is genuinely none to see —
    // and the run says the rate was pinned rather than checked.
    expect(fit.bracketResidualMs).toBeNull();
    expect(run.verdict.value).toBe("pinned");
  });

  it("hands the offsets over once the bracket closes", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }

    expect(await run.apply()).toBe(true);
    expect(fakes.session.apply).toHaveBeenCalledWith(run.fit.value!.offsetsMs);
    expect(run.applyResult.value).toEqual({
      applied: { living: 12 },
      previous: { living: 0 },
      manual: { kitchen: 0 },
    });
  });

  it("walks again over the applied delays without mixing the two walks", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 30, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }
    await run.apply();

    run.verify();

    // The speakers carry their corrections now. One fit over readings from both
    // sides of the apply would see every speaker jump part-way through.
    expect(run.verifying.value).toBe(true);
    expect(run.visits.value).toEqual([]);
    expect(run.fit.value).toBeNull();
    expect(run.applyResult.value).toBeNull();
    expect(run.phase.value).toBe("walking");
  });

  it("has nothing to check before anything was applied", async () => {
    const run = await started();
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );
    await measure(run, "living");

    run.verify();

    expect(run.verifying.value).toBe(false);
    expect(run.visits.value).toHaveLength(1);
  });

  it("refuses to apply while a speaker has never been heard", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 60, offsetSeconds: 0, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }
    const silence = recordingAt({
      startSeconds: 30,
      offsetSeconds: 0,
      drift: 0,
    });
    silence.samples.fill(0);
    fakes.capture.record.mockResolvedValue(silence);
    await measure(run, "kitchen");

    // kitchen contributed no arrivals, so it has no offset. Applying anyway would
    // re-normalise the speakers that do have one and leave kitchen where it was,
    // making the misalignment worse than before calibration.
    expect(run.fit.value!.offsetsMs).not.toHaveProperty("kitchen");
    expect(run.verdict.value).toBe("unmeasured");
    expect(run.trustworthy.value).toBe(false);
    expect(await run.apply()).toBe(false);
    expect(fakes.session.apply).not.toHaveBeenCalled();
  });

  it("will not accept two readings taken moments apart as a bracket", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      // Tapping "measure again" as soon as the first reading finishes: two readings
      // of the anchor, but over nine seconds of what becomes a two minute run.
      { startSeconds: 9, offsetSeconds: 0, player: "living" },
      { startSeconds: 120, offsetSeconds: 0.012, player: "kitchen" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }

    // The clock rate would be fitted over 9 of 128 seconds, which pins it about as
    // well as not bracketing at all — so the walk keeps asking for the real one.
    expect(run.fit.value!.bracketSpanSeconds).toBeCloseTo(9, 0);
    expect(run.verdict.value).toBe("short_bracket");
    expect(run.trustworthy.value).toBe(false);
    expect(run.needsBracket.value).toBe(true);
    // And no cross-check is offered on top of it: another reading would not
    // answer what is wrong here.
    expect(run.needsCheck.value).toBe(false);
    expect(await run.apply()).toBe(false);
  });

  it("accepts the bracket once it spans the walk", async () => {
    const run = await started();
    for (const visit of [
      { startSeconds: 0, offsetSeconds: 0, player: "living" },
      { startSeconds: 9, offsetSeconds: 0, player: "living" },
      { startSeconds: 120, offsetSeconds: 0.012, player: "kitchen" },
      { startSeconds: 180, offsetSeconds: 0, player: "living" },
    ]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ ...visit, drift: 0 }),
      );
      await measure(run, visit.player);
    }

    expect(run.needsBracket.value).toBe(false);
    expect(run.trustworthy.value).toBe(true);
  });

  it("voids the run when the audio context stops, and measures no further", async () => {
    const run = await started();
    voided.value = "suspended";
    await vi.advanceTimersByTimeAsync(0);

    expect(run.phase.value).toBe("voided");
    expect(await measure(run, "living")).toBe(false);
    expect(fakes.session.solo).not.toHaveBeenCalled();
  });

  it("gives the speakers back as soon as a run is voided", async () => {
    await started();
    voided.value = "suspended";
    await vi.advanceTimersByTimeAsync(0);

    // Nothing of the run can be used, so the house does not stay silent until
    // somebody reads the screen and taps a button.
    expect(fakes.session.stop).toHaveBeenCalledOnce();
    expect(fakes.capture.close).toHaveBeenCalledOnce();
  });

  it("voids the run when the server session goes away", async () => {
    const run = await started();
    sessionLost.value = "expired";
    await vi.advanceTimersByTimeAsync(0);

    expect(run.phase.value).toBe("voided");
    // The server has the speakers back already; the microphone is all that is
    // left to let go of.
    expect(fakes.capture.close).toHaveBeenCalledOnce();
  });

  it("stays where it was when the server refuses the start", async () => {
    fakes.session.start.mockResolvedValue(false);
    const run = withScope(() => useCalibrationRun());
    run.selected.value = ["living", "kitchen"];

    expect(await run.begin()).toBe(false);

    // A muted speaker is put right in a moment, and is no reason to send the
    // user back through anything. The microphone is let go of meanwhile.
    expect(run.phase.value).toBe("picking");
    expect(run.selected.value).toEqual(["living", "kitchen"]);
    expect(fakes.capture.close).toHaveBeenCalledOnce();
    expect(run.starting.value).toBe(false);
  });

  it("takes one tap on Start, however many land", async () => {
    const run = withScope(() => useCalibrationRun());
    run.selected.value = ["living", "kitchen"];

    // The microphone prompt can sit there for as long as the user likes.
    const [first, second] = await Promise.all([run.begin(), run.begin()]);

    expect([first, second]).toEqual([true, false]);
    expect(fakes.capture.open).toHaveBeenCalledOnce();
    expect(fakes.session.start).toHaveBeenCalledOnce();
  });

  it("goes on walking when a solo did not get through", async () => {
    const run = await started();
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );
    await measure(run, "living");
    fakes.session.solo.mockResolvedValueOnce(false);

    expect(await measure(run, "kitchen")).toBe(false);

    // The session says why. The reading already taken is as good as it was.
    expect(run.phase.value).toBe("walking");
    expect(run.visits.value).toHaveLength(1);
  });

  it("replaces a reading that is taken again because it came out badly", async () => {
    const run = await started();
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );
    await measure(run, "living");
    const silence = recordingAt({
      startSeconds: 30,
      offsetSeconds: 0,
      drift: 0,
    });
    silence.samples.fill(0);
    fakes.capture.record.mockResolvedValue(silence);
    await measure(run, "kitchen");
    expect(run.visits.value.map((visit) => visit.found)).toEqual([
      expect.any(Number),
      0,
    ]);

    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 45, offsetSeconds: 0.012, drift: 0 }),
    );
    await measure(run, "kitchen", true);

    // Two readings still, not three: a poor one left in would go on pulling at
    // the result.
    expect(run.visits.value.map((visit) => visit.playerId)).toEqual([
      "living",
      "kitchen",
    ]);
    expect(run.visits.value[1].found).toBeGreaterThanOrEqual(CHIRPS_HELD);
    expect(run.fit.value!.offsetsMs.kitchen).toBeCloseTo(12, 1);
  });

  it("keeps the earlier reading when the retake could not be recorded", async () => {
    const run = await started();
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );
    await measure(run, "living");
    fakes.capture.record.mockResolvedValue(null);

    expect(await measure(run, "living", true)).toBe(false);

    expect(run.visits.value).toHaveLength(1);
  });

  it("adds a second reading when a speaker is simply measured again", async () => {
    const run = await started();
    for (const startSeconds of [0, 60]) {
      fakes.capture.record.mockResolvedValue(
        recordingAt({ startSeconds, offsetSeconds: 0, drift: 0 }),
      );
      await measure(run, "living");
    }

    // The closing steps of the walk ask for exactly this: a second reading of a
    // speaker is what the clock drift is worked out from.
    expect(run.visits.value).toHaveLength(2);
  });

  it("does not anchor on a reading that heard nothing", async () => {
    const run = await started();
    const silence = recordingAt({
      startSeconds: 0,
      offsetSeconds: 0,
      drift: 0,
    });
    silence.samples.fill(0);
    fakes.capture.record.mockResolvedValue(silence);
    await measure(run, "living");
    expect(run.anchor.value).toBeNull();

    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 30, offsetSeconds: 0, drift: 0 }),
    );
    await measure(run, "kitchen");

    // The silent reading put no arrivals into the fit, so it is no reference,
    // and the walk must not send the user back to it at the end.
    expect(run.anchor.value).toBe("kitchen");
  });

  it("starts the walk over on the session and microphone it already has", async () => {
    const run = await started();
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );
    await measure(run, "living");

    run.clearReadings();

    expect(run.visits.value).toEqual([]);
    expect(run.fit.value).toBeNull();
    expect(run.phase.value).toBe("walking");
    // The recording has run without a gap, so nothing has to be opened again.
    expect(fakes.session.stop).not.toHaveBeenCalled();
    expect(fakes.capture.close).not.toHaveBeenCalled();
  });

  it("counts a reading down and buzzes when it is done", async () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const run = await started();
    let finish: (recording: Recording) => void = () => undefined;
    fakes.capture.record.mockReturnValue(
      new Promise<Recording>((resolve) => {
        finish = resolve;
      }),
    );

    const pending = run.measure("living");
    await vi.advanceTimersByTimeAsync(0);
    expect(run.secondsLeft.value).toBe(Math.ceil(1 + RECORD_SECONDS));
    await vi.advanceTimersByTimeAsync(3000);
    expect(run.secondsLeft.value).toBe(Math.ceil(1 + RECORD_SECONDS) - 3);

    finish(recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }));
    await pending;

    // The user is looking at the room, not the screen.
    expect(vibrate).toHaveBeenCalledOnce();
    expect(run.secondsLeft.value).toBe(0);
    vi.unstubAllGlobals();
  });

  it("ends a run found on another device only when asked to", async () => {
    const run = withScope(() => useCalibrationRun());

    await run.endAdopted();

    expect(fakes.session.stop).toHaveBeenCalledWith(true);
  });

  it("throws a voided run away rather than salvaging part of it", async () => {
    const run = await started();
    fakes.capture.record.mockResolvedValue(
      recordingAt({ startSeconds: 0, offsetSeconds: 0, drift: 0 }),
    );
    await measure(run, "living");
    voided.value = "suspended";
    await vi.advanceTimersByTimeAsync(0);

    await run.restart();

    // Arrivals from before the gap cannot be placed on the same timeline as
    // anything after it, so keeping any of them would only hide the problem.
    expect(run.visits.value).toEqual([]);
    expect(run.fit.value).toBeNull();
    expect(run.phase.value).toBe("picking");
    expect(fakes.session.stop).toHaveBeenCalled();
    expect(fakes.capture.close).toHaveBeenCalled();
  });

  it("keeps a reading that found nothing, so its confidence can be seen", async () => {
    const run = await started();
    const silence = recordingAt({
      startSeconds: 0,
      offsetSeconds: 0,
      drift: 0,
      seconds: RECORD_SECONDS,
    });
    silence.samples.fill(0);
    fakes.capture.record.mockResolvedValue(silence);

    expect(await measure(run, "living")).toBe(false);
    expect(run.visits.value).toHaveLength(1);
    expect(run.visits.value[0].found).toBe(0);
    expect(run.phase.value).toBe("walking");
  });

  it("releases everything when the run is finished", async () => {
    const run = await started();

    await run.finish();

    expect(fakes.session.stop).toHaveBeenCalledOnce();
    expect(fakes.capture.close).toHaveBeenCalledOnce();
  });
});
