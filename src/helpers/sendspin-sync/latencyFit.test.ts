import { CHIRP_PERIOD_SECONDS } from "@/helpers/sendspin-sync/chirp";
import {
  fitLatencies,
  MAX_OFFSET_SPAN_MS,
  MAX_PLAUSIBLE_RATE_PPM,
  type ArrivalSample,
} from "@/helpers/sendspin-sync/latencyFit";
import { describe, expect, it } from "vitest";

const CHIRPS_PER_VISIT = 10;

/**
 * Where the run's first arrival lands on the recording, in seconds.
 *
 * Neither zero nor a whole number of periods. The fit carries a constant for the
 * microphone's own input latency and for the chirp the session happened to start
 * on, and a fixture whose first arrival sits at zero cannot tell a fit that
 * solves for that constant from one that assumes it away.
 */
const RECORDING_START_SECONDS = 3.31;

interface Visit {
  playerId: string;
  /** Index of the first chirp of this visit in the server's chirp train. */
  fromChirp: number;
}

/**
 * Build arrivals that satisfy the model exactly.
 *
 * A chirp emitted `chirp` periods into the server's train is heard `offset` later
 * and stamped by a phone whose clock runs `drift` fast, so it lands at
 * `start + (1 + drift) * chirp * period + offset`. Generating the model forward
 * rather than approximating it keeps the expected answer exact, so a failure
 * means the estimator is wrong and not that the fixture was sloppy.
 */
function synthesize(
  visits: Visit[],
  offsets: Record<string, number>,
  drift: number,
): ArrivalSample[] {
  return visits.flatMap((visit, index) =>
    Array.from({ length: CHIRPS_PER_VISIT }, (_, step) => {
      const chirp = visit.fromChirp + step;
      return {
        visit: index,
        playerId: visit.playerId,
        at:
          RECORDING_START_SECONDS +
          (1 + drift) * chirp * CHIRP_PERIOD_SECONDS +
          offsets[visit.playerId],
      };
    }),
  );
}

/** Reduce a span of seconds to its distance from the nearest whole period. */
function wrapToPeriod(seconds: number): number {
  return (
    seconds - CHIRP_PERIOD_SECONDS * Math.round(seconds / CHIRP_PERIOD_SECONDS)
  );
}

/** A speaker's mean arrival phase, which is the reading a drift-blind fit gets. */
function meanPhase(samples: ArrivalSample[], playerId: string): number {
  const reference = samples[0].at;
  const phases = samples
    .filter((sample) => sample.playerId === playerId)
    .map((sample) => wrapToPeriod(sample.at - reference));
  return phases.reduce((total, value) => total + value, 0) / phases.length;
}

/** How far apart the furthest two speakers came out, in milliseconds. */
function offsetSpanMs(offsetsMs: Record<string, number>): number {
  const offsets = Object.values(offsetsMs);
  return Math.max(...offsets) - Math.min(...offsets);
}

/** Deterministic jitter, so a failure is always reproducible. */
function jitter(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648 - 0.5;
  };
}

/** The walk the flow prescribes: each speaker in turn, the first one again last. */
const WALK: Visit[] = [
  { playerId: "living", fromChirp: 0 },
  { playerId: "kitchen", fromChirp: 30 },
  { playerId: "study", fromChirp: 60 },
  { playerId: "living", fromChirp: 90 },
];

const OFFSETS = { living: 0, kitchen: 0.012, study: -0.007 };

describe("MAX_OFFSET_SPAN_MS", () => {
  it("is half a chirp period, which is the whole of what one train can say", () => {
    expect(MAX_OFFSET_SPAN_MS).toBe((CHIRP_PERIOD_SECONDS / 2) * 1000);
    // And what that comes to in this build, which is the figure the panel quotes
    // and the window a group of speakers has to fit inside.
    expect(MAX_OFFSET_SPAN_MS).toBe(500);
  });
});

describe("fitLatencies", () => {
  it("recovers the clock rate and every offset from exact arrivals", () => {
    const fit = fitLatencies(synthesize(WALK, OFFSETS, 40e-6));

    expect(fit).not.toBeNull();
    expect(fit!.rateErrorPpm).toBeCloseTo(40, 6);
    expect(fit!.rateRatio).toBeCloseTo(1 + 40e-6, 12);
    expect(fit!.offsetsMs.living).toBeCloseTo(0, 9);
    expect(fit!.offsetsMs.kitchen).toBeCloseTo(12, 6);
    expect(fit!.offsetsMs.study).toBeCloseTo(-7, 6);
    expect(fit!.rejected).toBe(0);
    expect(fit!.used).toBe(WALK.length * CHIRPS_PER_VISIT);
  });

  it("reports the baseline the clock rate was measured over", () => {
    const fit = fitLatencies(synthesize(WALK, OFFSETS, 40e-6))!;

    // living is measured at chirp 0 and again at chirp 90, so 90 seconds apart.
    expect(fit.bracketSpanSeconds).toBeCloseTo(90, 0);
    expect(fit.residualMs).toBeLessThan(0.001);
  });

  it("has no baseline at all when no speaker was measured twice", () => {
    const once = WALK.slice(0, 3);
    const fit = fitLatencies(synthesize(once, OFFSETS, 40e-6))!;

    expect(fit.bracketSpanSeconds).toBeNull();
    expect(fit.bracketResidualMs).toBeNull();
  });

  it("will not claim to have checked a rate that one repeat merely set", () => {
    // The single repeat is the one constraint that determines the rate, so the
    // fit absorbs any disagreement between its two readings into the rate and
    // leaves nothing behind. Reporting a near-zero residual here would read as a
    // pass for a run that was never tested.
    const shifted: Visit[] = [
      { playerId: "living", fromChirp: 0 },
      { playerId: "kitchen", fromChirp: 30 },
      { playerId: "living", fromChirp: 60 },
    ];
    const drifted = synthesize(shifted, OFFSETS, 0).map((sample, index) =>
      // The anchor's second visit reads 6 ms further out than its first.
      index >= 20 ? { ...sample, at: sample.at + 0.006 } : sample,
    );

    const fit = fitLatencies(drifted)!;
    expect(fit.bracketResidualMs).toBeNull();
    expect(fit.bracketSpanSeconds).toBeCloseTo(60, 0);
    // The shift went into the rate instead, which is exactly why it cannot be
    // seen: 6 ms across the 60 seconds between the two readings, and a phone
    // 100 ppm out is unremarkable.
    expect(Math.abs(fit.rateErrorPpm - 100)).toBeLessThan(2);
  });

  it("reports a disagreement once two speakers were each measured twice", () => {
    const twice: Visit[] = [
      { playerId: "living", fromChirp: 0 },
      { playerId: "kitchen", fromChirp: 30 },
      { playerId: "living", fromChirp: 60 },
      { playerId: "kitchen", fromChirp: 90 },
    ];
    const clean = fitLatencies(synthesize(twice, OFFSETS, 40e-6))!;
    expect(clean.bracketResidualMs).not.toBeNull();
    expect(clean.bracketResidualMs!).toBeLessThan(0.001);

    // Now kitchen's second reading is 5 ms out. With one constraint more than the
    // rate can absorb, it finally shows.
    const spoiled = synthesize(twice, OFFSETS, 40e-6).map((sample, index) =>
      index >= 30 ? { ...sample, at: sample.at + 0.005 } : sample,
    );
    expect(fitLatencies(spoiled)!.bracketResidualMs!).toBeGreaterThan(1);
  });

  it("holds up when the arrivals carry detection jitter", () => {
    const noise = jitter(7);
    const samples = synthesize(WALK, OFFSETS, 40e-6).map((sample) => ({
      ...sample,
      // ±0.2 ms, comfortably worse than a matched filter's own resolution.
      at: sample.at + noise() * 4e-4,
    }));

    // Ten arrivals per visit cannot average ±0.2 ms of jitter away entirely, so
    // the bar is the one the measurement has to clear: well inside a
    // millisecond, not exact recovery.
    const fit = fitLatencies(samples)!;
    expect(Math.abs(fit.offsetsMs.kitchen - 12)).toBeLessThan(0.2);
    expect(Math.abs(fit.offsetsMs.study - -7)).toBeLessThan(0.2);
    expect(fit.rateErrorPpm).toBeCloseTo(40, 0);
  });

  it("rejects an arrival that fell on a different path", () => {
    const samples = synthesize(WALK, OFFSETS, 40e-6);
    // A reflection picked up instead of the direct arrival: plausible in
    // isolation, impossible against the rest of the visit.
    samples[15] = { ...samples[15], at: samples[15].at + 0.03 };

    const fit = fitLatencies(samples)!;
    expect(fit.rejected).toBeGreaterThanOrEqual(1);
    expect(fit.offsetsMs.kitchen).toBeCloseTo(12, 3);
    expect(fit.offsetsMs.study).toBeCloseTo(-7, 3);
  });

  it("survives a reflection heard in place of a visit's first arrival", () => {
    const samples = synthesize(WALK, OFFSETS, 40e-6);
    // The chirp that opens the study reading is missed and an echo is taken for
    // it. Every chirp number in that visit is counted from its first arrival, so
    // a bad one there would otherwise move the whole visit.
    samples[20] = { ...samples[20], at: samples[20].at + 0.04 };

    const fit = fitLatencies(samples)!;
    expect(fit.rejected).toBe(1);
    expect(fit.offsetsMs.kitchen).toBeCloseTo(12, 3);
    expect(fit.offsetsMs.study).toBeCloseTo(-7, 3);
    expect(fit.rateErrorPpm).toBeCloseTo(40, 1);
  });

  it("fits the drift out, which a per-speaker average cannot", () => {
    // 120 ppm across a 100 second walk: within spec for a consumer crystal, and
    // already an order of magnitude above the offsets being measured.
    const samples = synthesize(WALK, OFFSETS, 120e-6);
    const fit = fitLatencies(samples)!;

    expect(fit.offsetsMs.kitchen).toBeCloseTo(12, 6);
    expect(fit.offsetsMs.study).toBeCloseTo(-7, 6);

    const naive =
      (meanPhase(samples, "study") - meanPhase(samples, "living")) * 1000;
    expect(Math.abs(naive - -7)).toBeGreaterThan(1);
  });

  it("survives a drift big enough to wrap the phase right round", () => {
    // 1000 ppm is the point the microphone probe starts warning at, so it is a
    // clock the flow still lets through. Across a twenty minute walk the drift
    // term passes a whole period: numbering every arrival against one fixed
    // arrival would fold here and report a confident wrong answer, which is why
    // each visit is numbered against the one before it instead.
    const walk: Visit[] = [
      { playerId: "living", fromChirp: 0 },
      { playerId: "kitchen", fromChirp: 300 },
      { playerId: "study", fromChirp: 600 },
      { playerId: "porch", fromChirp: 900 },
      { playerId: "living", fromChirp: 1200 },
    ];
    const offsets = { ...OFFSETS, porch: 0.019 };

    const fit = fitLatencies(synthesize(walk, offsets, 1000e-6))!;
    expect(fit.rateErrorPpm).toBeCloseTo(1000, 3);
    expect(fit.offsetsMs.kitchen).toBeCloseTo(12, 5);
    expect(fit.offsetsMs.study).toBeCloseTo(-7, 5);
    expect(fit.offsetsMs.porch).toBeCloseTo(19, 5);
    // Measured on the phone's clock, so a twenty minute walk reads 1.2 s long at
    // this drift — which is the whole reason the drift has to be fitted.
    expect(fit.bracketSpanSeconds!).toBeCloseTo(1201.2, 1);
  });

  it("indexes straight through the silences a walk is made of", () => {
    // The two runs that came back -3318 and -5326 ppm from a phone, which at this
    // period would read twice that. Both were a whole chirp period misassigned
    // across a silence — a second over the 150 s and 94 s those walks took — and
    // this one carries both silences, with the widest offset spread seen in
    // testing. The phone recorded throughout, so the chirps that went by during
    // each silence are counted rather than guessed, and there is no branch left to
    // get wrong.
    const walk: Visit[] = [
      { playerId: "living", fromChirp: 0 },
      { playerId: "kitchen", fromChirp: 155 },
      { playerId: "study", fromChirp: 253 },
      { playerId: "living", fromChirp: 408 },
    ];
    const offsets = { living: 0, kitchen: 0.116, study: -0.004 };

    const fit = fitLatencies(synthesize(walk, offsets, 5e-6))!;

    expect(fit.rateErrorPpm).toBeCloseTo(5, 6);
    expect(Math.abs(fit.rateErrorPpm)).toBeLessThan(MAX_PLAUSIBLE_RATE_PPM);
    expect(fit.offsetsMs.living).toBeCloseTo(0, 9);
    expect(fit.offsetsMs.kitchen).toBeCloseTo(116, 6);
    expect(fit.offsetsMs.study).toBeCloseTo(-4, 6);
    // Scatter is what is left over once the line is subtracted, so a run this
    // clean has to come back at detection precision rather than carrying fit
    // error the offsets above have already absorbed.
    expect(fit.residualMs).toBeLessThan(0.001);
    for (const scatter of Object.values(fit.scatterMs))
      expect(scatter).toBeLessThan(0.001);
  });

  it("leaves speakers spread past half a period visible in the offsets", () => {
    // Three speakers 300 ms apart in turn, the furthest 600 ms behind the first.
    // Each step is placeable, so these are the delays the room really has — but
    // the reading rests on the order they were walked in, and the span says so
    // where `runVerdict` can refuse on it.
    const walk: Visit[] = [
      { playerId: "living", fromChirp: 0 },
      { playerId: "kitchen", fromChirp: 75 },
      { playerId: "study", fromChirp: 150 },
    ];

    const fit = fitLatencies(
      synthesize(walk, { living: 0, kitchen: 0.3, study: 0.6 }, 5e-6),
    )!;

    expect(offsetSpanMs(fit.offsetsMs)).toBeGreaterThan(MAX_OFFSET_SPAN_MS);
  });

  it("still reports an impossible rate the arrivals genuinely carry", () => {
    // 5000 ppm across silences short enough that nothing is misassigned: the fit
    // is the only one the arrivals admit. It comes back so the verdict can refuse
    // the run and say why, rather than the panel quietly having nothing to show.
    const walk: Visit[] = [
      { playerId: "living", fromChirp: 0 },
      { playerId: "kitchen", fromChirp: 80 },
      { playerId: "living", fromChirp: 160 },
    ];

    const fit = fitLatencies(synthesize(walk, OFFSETS, 5000e-6))!;

    expect(fit.rateErrorPpm).toBeCloseTo(5000, 0);
    expect(Math.abs(fit.rateErrorPpm)).toBeGreaterThan(MAX_PLAUSIBLE_RATE_PPM);
    expect(offsetSpanMs(fit.offsetsMs)).toBeLessThan(MAX_OFFSET_SPAN_MS);
  });

  it("reports each speaker's own scatter, not one figure for the run", () => {
    const noise = jitter(11);
    const samples = synthesize(WALK, OFFSETS, 40e-6).map((sample) =>
      // Only the kitchen reading is spoiled, by ±5 ms of detection error.
      sample.playerId === "kitchen"
        ? { ...sample, at: sample.at + noise() * 1e-2 }
        : sample,
    );

    const fit = fitLatencies(samples)!;

    // Two orders of magnitude apart, which is the whole point: one figure for
    // the run would report the median of these and name neither. The clean
    // speakers are not exactly zero because the spoiled one drags the fitted line
    // a little, and that leak is the scale the difference has to be read against.
    expect(fit.scatterMs.kitchen).toBeGreaterThan(1);
    expect(fit.scatterMs.living).toBeLessThan(0.05);
    expect(fit.scatterMs.study).toBeLessThan(0.05);
  });

  it("stops widening the outlier threshold once it would reject nothing", () => {
    // Scaled off the visit's own spread alone, one badly detected arrival in
    // five drags the threshold out past itself. The ceiling is what keeps the
    // pass working on a recording that is merely poor rather than hopeless.
    const noise = jitter(3);
    const samples = synthesize(WALK, OFFSETS, 40e-6).map((sample, index) =>
      // Four of the kitchen's ten arrivals land tens of milliseconds late, which
      // is a reflection rather than the direct sound.
      index >= 10 && index < 14
        ? { ...sample, at: sample.at + 0.02 + noise() * 1e-2 }
        : sample,
    );

    const fit = fitLatencies(samples)!;

    expect(fit.rejected).toBe(4);
    expect(fit.offsetsMs.kitchen).toBeCloseTo(12, 3);
  });

  it("reports nothing when the arrivals cannot determine the model", () => {
    expect(fitLatencies([])).toBeNull();
    expect(
      fitLatencies([
        { visit: 0, playerId: "living", at: 0 },
        { visit: 0, playerId: "living", at: 0.5 },
      ]),
    ).toBeNull();

    // Every arrival at one instant leaves the clock rate unidentifiable.
    expect(
      fitLatencies(
        Array.from({ length: 8 }, () => ({
          visit: 0,
          playerId: "living",
          at: 1,
        })),
      ),
    ).toBeNull();
  });

  it("summarizes each visit separately, in the order they were measured", () => {
    const fit = fitLatencies(synthesize(WALK, OFFSETS, 40e-6))!;

    expect(fit.visits.map((visit) => visit.playerId)).toEqual([
      "living",
      "kitchen",
      "study",
      "living",
    ]);
    for (const visit of fit.visits) {
      expect(visit.samples).toBe(CHIRPS_PER_VISIT);
      expect(visit.used).toBe(CHIRPS_PER_VISIT);
      expect(Math.abs(visit.meanResidualMs)).toBeLessThan(0.001);
      expect(visit.spreadMs).toBeLessThan(0.001);
    }
  });
});
