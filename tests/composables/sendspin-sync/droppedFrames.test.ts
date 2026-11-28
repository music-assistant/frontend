/**
 * A whole walk, from the capture worklet through to the fitted latencies, with
 * render quanta dropped in the middle of it.
 *
 * The failure this reproduces came back at -6868 ppm with every speaker
 * scattering 13-15 ms, from a three speaker walk whose second leg was a long one
 * upstairs. Nothing was wrong with the speakers: the phone stalled while it was
 * being carried, and a capture that timed arrivals by counting the frames it had
 * been handed closed that stall up, timing every arrival after it early by the
 * length of the stall and numbering a whole burst onto the wrong chirp.
 *
 * So this covers the seam rather than any one unit. The worklet numbers batches,
 * `assemble` turns those numbers into a timeline, `scanArrivals` reads arrivals
 * off it and `fitLatencies` reads a clock rate and one offset per speaker off
 * those — and the stall is only visible if every one of them is honest about it.
 * Each stage is the real one; only the microphone and the audio thread are not.
 */

import {
  chirpPhase,
  CHIRP_PERIOD_SECONDS,
  CHIRP_SECONDS,
} from "@/helpers/sendspin-sync/chirp";
import { scanArrivals } from "@/helpers/sendspin-sync/chirpArrivals";
import {
  fitLatencies,
  MAX_PLAUSIBLE_RATE_PPM,
  type ArrivalSample,
  type LatencyFit,
} from "@/helpers/sendspin-sync/latencyFit";
import {
  isApplicable,
  runVerdict,
  type CaptureLoss,
} from "@/helpers/sendspin-sync/verdict";
import {
  assemble,
  type CaptureBatch,
} from "@/composables/sendspin-sync/useChirpCapture";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RATE = 48000;
const RENDER_QUANTUM = 128;
const PERIOD_FRAMES = CHIRP_PERIOD_SECONDS * RATE;
const CHIRP_FRAMES = Math.round(CHIRP_SECONDS * RATE);

/** The phone's clock against the server's — a few ppm, as a healthy one is. */
const DRIFT = 5e-6;

/** The latencies the walk is there to recover, in seconds. */
const OFFSETS: Record<string, number> = {
  living: 0,
  kitchen: 0.012,
  study: -0.007,
};

const SELECTED = ["living", "kitchen", "study"];

/**
 * Where the server's first chirp was heard from the anchor, in frames.
 *
 * Neither zero nor a whole number of periods: the fit carries a constant for the
 * microphone's own input latency and the chirp the session started on, and a
 * fixture sitting at zero cannot tell a fit that solves for it from one that
 * assumes it away.
 */
const ORIGIN_FRAME = 62_881;

/**
 * How many render quanta the audio thread misses on the long leg.
 *
 * 256 of them is 683 ms, and what matters is that it clears half a chirp period.
 * Below that the chirp numbering rounds back to the right answer on its own and
 * a compressed timeline shows up only as scatter; above it a whole burst lands on
 * the wrong chirp, which is the failure being reproduced. A one second period
 * takes twice the stall the old half-second one did to get there — the same run
 * on a phone stalling 341 ms would now survive it — so the fixture stalls twice as
 * long to stay past the edge.
 */
const STALL_QUANTA = 256;

/** As long as the run records for one speaker, so a leg holds seven chirps. */
const ARMED_SECONDS = 7 * CHIRP_PERIOD_SECONDS;

/** The walk: three speakers, the anchor measured again at the end. */
const LEGS: { playerId?: string; seconds: number; stalls?: boolean }[] = [
  { seconds: 1 },
  { playerId: "living", seconds: ARMED_SECONDS },
  { seconds: 12, stalls: true },
  { playerId: "kitchen", seconds: ARMED_SECONDS },
  { seconds: 6 },
  { playerId: "study", seconds: ARMED_SECONDS },
  { seconds: 6 },
  { playerId: "living", seconds: ARMED_SECONDS },
];

interface Processor {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
  port: { onmessage: ((event: { data: unknown }) => void) | null };
}

/** One speaker's recording, as the batches the worklet posted for it. */
interface Visit {
  playerId: string;
  batches: CaptureBatch[];
  /** Frames the audio thread had missed by the time this recording began. */
  missed: number;
}

let posted: CaptureBatch[] = [];
let ProcessorClass: new () => Processor;
/** The one walk every case below reads, since only the numbering differs. */
let walk: Visit[] = [];

beforeAll(async () => {
  class FakeAudioWorkletProcessor {
    port = {
      onmessage: null,
      postMessage: (batch: CaptureBatch) => posted.push(batch),
    };
  }
  vi.stubGlobal("AudioWorkletProcessor", FakeAudioWorkletProcessor);
  vi.stubGlobal(
    "registerProcessor",
    (_: string, processor: typeof ProcessorClass) => {
      ProcessorClass = processor;
    },
  );

  // The processor ships as untyped JavaScript on purpose: it is loaded by
  // `addModule()` into a worklet scope, never through the app's type graph.
  // @ts-expect-error -- no declarations, and none wanted
  await import("@/composables/sendspin-sync/chirpCaptureProcessor.js");

  walk = walkTheHouse();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("a walk that dropped frames", () => {
  it("recovers the offsets and the rate across a stalled leg", () => {
    const fit = fitWalk(walk, (batch) => batch.startFrame);

    expect(fit.offsetsMs.living).toBeCloseTo(0, 6);
    expect(fit.offsetsMs.kitchen).toBeCloseTo(12, 1);
    expect(fit.offsetsMs.study).toBeCloseTo(-7, 1);
    expect(Math.abs(fit.rateErrorPpm - DRIFT * 1e6)).toBeLessThan(10);
    // Every arrival on the fitted line to detector precision, which is what says
    // the stall left no compression behind rather than merely a small one.
    expect(fit.residualMs).toBeLessThan(0.1);

    // And the run is offered for applying, which is the whole point of it.
    expect(isApplicable(runVerdict(fit, SELECTED, clean()))).toBe(true);
  });

  it("counts the stall against nothing, because it fell between speakers", () => {
    // A stall while nobody is listening costs the measurement nothing once the
    // clock has accounted for it, so it is not a fault to hold against the run.
    // Were it reported anyway, a walk with a long leg would fail closed on the
    // one thing about a long leg that is free.
    for (const visit of walk) {
      const last = visit.batches[visit.batches.length - 1];
      expect(last.dropouts).toBe(0);
      expect(last.lostFrames).toBe(0);
    }
  });

  it("is wrong when the same batches are numbered by frames delivered", () => {
    // What the capture did before: a tally that never sees a quantum it was not
    // called for, so every recording after the stall is numbered 683 ms early and
    // the burst inside it lands on the chirp before its own.
    const fit = fitWalk(
      walk,
      (batch, visit) => batch.startFrame - visit.missed,
    );

    expect(Math.abs(fit.rateErrorPpm)).toBeGreaterThan(MAX_PLAUSIBLE_RATE_PPM);
    // A misnumbered chirp has to go somewhere, and it goes into the offsets as
    // well as into the rate — this is the "13-15 ms of scatter" run, where every
    // speaker came back wrong by far more than the millisecond being measured.
    expect(Math.abs(fit.offsetsMs.kitchen - 12)).toBeGreaterThan(50);
    expect(isApplicable(runVerdict(fit, SELECTED, clean()))).toBe(false);
  });
});

/** A run whose recordings heard everything they were armed for. */
function clean(): CaptureLoss {
  return { dropouts: 0, worstFraction: 0 };
}

/**
 * Walk the house, driving the real worklet one render quantum at a time.
 *
 * The armed legs are fed a synthesised recording of the speaker being measured;
 * the rest are fed nothing, which is what the microphone delivers while the
 * others are muted. On the long leg the render clock jumps past
 * {@link STALL_QUANTA} quanta without `process` being called at all, which is
 * what a busy phone does to an audio thread.
 */
function walkTheHouse(): Visit[] {
  const processor = new ProcessorClass();
  const visits: Visit[] = [];
  let frame = 0;
  let missed = 0;

  const arm = (armed: boolean) =>
    processor.port.onmessage?.({ data: { armed } });

  for (const leg of LEGS) {
    const quanta = Math.round((leg.seconds * RATE) / RENDER_QUANTUM);
    if (leg.playerId) {
      posted = [];
      arm(true);
    }

    for (let quantum = 0; quantum < quanta; quantum++) {
      if (leg.stalls && quantum === quanta >> 1) {
        frame += STALL_QUANTA * RENDER_QUANTUM;
        missed += STALL_QUANTA * RENDER_QUANTUM;
      }
      vi.stubGlobal("currentFrame", frame);

      const inputs = leg.playerId ? [[capture(frame, leg.playerId)]] : [[]];
      processor.process(inputs as Float32Array[][], [
        [new Float32Array(RENDER_QUANTUM)],
      ]);
      frame += RENDER_QUANTUM;
    }

    if (leg.playerId) {
      arm(false);
      visits.push({ playerId: leg.playerId, batches: posted, missed });
    }
  }

  return visits;
}

/**
 * Run the walk's batches through the measurement, numbering each by `startFrame`.
 *
 * The numbering is the variable because it is the whole of what this change
 * touches: everything downstream of it reads a timeline, and cannot tell an
 * honest one from a compressed one.
 */
function fitWalk(
  visits: Visit[],
  startFrame: (batch: CaptureBatch, visit: Visit) => number,
): LatencyFit {
  const arrivals: ArrivalSample[] = visits.flatMap((visit, index) => {
    const recording = assemble(
      visit.batches.map((batch) => ({
        ...batch,
        startFrame: startFrame(batch, visit),
      })),
      RATE,
    )!;
    const scan = scanArrivals(recording.samples, {
      sampleRate: RATE,
      firstFrame: recording.firstFrame,
    });
    // Enough chirps for the visit to be placed by its own median rather than by
    // whichever arrival happened to be found first.
    expect(scan.arrivals.length).toBeGreaterThanOrEqual(5);

    return scan.arrivals.map((arrival) => ({
      visit: index,
      playerId: visit.playerId,
      at: arrival.at,
    }));
  });

  return fitLatencies(arrivals)!;
}

/** One quantum of what the microphone heard from `playerId`, from `frame` on. */
function capture(frame: number, playerId: string): Float32Array {
  return Float32Array.from({ length: RENDER_QUANTUM }, (_, index) =>
    heard(frame + index, playerId),
  );
}

/**
 * What the microphone heard at one absolute frame.
 *
 * The chirp train is generated forward from the model the fit solves: chirp `n`
 * of the server's train is heard `offset` later, on a phone clock running
 * {@link DRIFT} fast. Generating it rather than approximating it keeps the
 * expected answer exact, so a failure means the measurement is wrong and not
 * that the fixture was sloppy.
 */
function heard(frame: number, playerId: string): number {
  const spacing = (1 + DRIFT) * PERIOD_FRAMES;
  const first = ORIGIN_FRAME + OFFSETS[playerId] * RATE;
  const chirp = Math.floor((frame - first) / spacing);

  let value = noise(frame);
  // A chirp is a sixteenth of a period long, so at most one of these overlaps.
  for (const index of [chirp, chirp + 1]) {
    const progress = (frame - (first + index * spacing)) / CHIRP_FRAMES;
    if (progress < 0 || progress >= 1) continue;
    const window = 0.5 * (1 - Math.cos(2 * Math.PI * progress));
    value += 0.5 * window * Math.sin(chirpPhase(progress));
  }
  return value;
}

/**
 * Room noise, keyed on the frame so it does not depend on how it is chopped up.
 *
 * Hashed rather than scaled: a value that is merely a linear function of the
 * frame repeats, and noise must not.
 */
function noise(frame: number): number {
  let state = Math.imul(frame + 1, 1103515245) + 12345;
  state = Math.imul(state ^ (state >>> 15), 2246822519);
  state = (state ^ (state >>> 13)) >>> 0;
  return (state / 4294967296 - 0.5) * 0.01;
}
