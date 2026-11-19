/**
 * Turns chirp arrival times into one latency figure per speaker.
 *
 * The server emits chirps on one uninterrupted stream, so the chirp train is a
 * metronome running on the server clock. The phone records continuously from the
 * first measurement to the last, so its own sample counter is an unbroken
 * measure of elapsed time. Between the two, every arrival can be told which
 * chirp of the train produced it — and the silences while the phone is carried
 * from one speaker to the next cost nothing, because the recording never stops
 * during them.
 *
 * Every arrival is modelled as
 *
 *     at = c + (1 + d) * chirp * CHIRP_PERIOD_SECONDS + offset[speaker]
 *
 * where `chirp` is which chirp of the train it was, `c` absorbs the microphone's
 * own input latency and the chirp the session happened to start on, `d` is the
 * phone audio clock's fractional excess over the server's, and `offset[speaker]`
 * is the figure being measured. `c` and the first speaker's offset are degenerate
 * with each other, so the first speaker's offset is fixed at zero and every
 * result is relative to it — which is exactly what the server's
 * `apply_measurements` expects.
 *
 * Fitting `d` across the whole session is not optional. Consumer clocks sit
 * inside ±100 ppm, which over a several-minute walk is several milliseconds of
 * drift — larger than the speaker latencies being measured.
 *
 * Which chirp an arrival came from is read off the recording rather than searched
 * for. Recorded seconds divided by the period round to the number of chirps that
 * went by, and moving that count by one takes half a second of accumulated clock
 * error — 5000 seconds of walking at 100 ppm. So the arrivals admit one reading
 * and one only: there is no phase to unwrap, no branch to choose between, and no
 * reason to hurry between speakers.
 *
 * The one thing this cannot do is reach past half a period. A speaker further
 * behind than that has its arrivals numbered onto the following chirp, and its
 * latency comes back folded — a period short, so with the wrong sign. Where the
 * fold leaves the speakers spanning more than half a period between them,
 * {@link MAX_OFFSET_SPAN_MS} refuses the run; where it does not, nothing here can
 * see it, because a latency is only ever known modulo the chirp period and one
 * chirp train has nothing to say about which side of it a speaker sits on.
 *
 * A fold that lands instead on the speaker the run is anchored to, whose offset is
 * fixed at zero, has nowhere to go but the clock rate: a whole period smeared
 * across the run. {@link MAX_PLAUSIBLE_RATE_PPM} refuses that while the run is
 * short enough for the figure to be absurd, which is about eight minutes; on a
 * longer walk the same fold implies a rate a merely poor clock could also have and
 * the two stop being separable. Neither refusal has anything to say about how the
 * walk was paced.
 */

import { CHIRP_PERIOD_SECONDS } from "./chirp";

/** One detected chirp arrival, timed on the phone's own audio clock. */
export interface ArrivalSample {
  /**
   * Which contiguous measurement this came from.
   *
   * A speaker measured twice produces two visits, which is what makes the
   * bracket check below possible.
   */
  visit: number;
  playerId: string;
  /** Arrival time in seconds on the phone's audio clock. */
  at: number;
}

export interface VisitFit {
  visit: number;
  playerId: string;
  samples: number;
  /** Samples that survived the outlier pass and reached the fit. */
  used: number;
  /** Where this visit sits against the fitted line, in milliseconds. */
  meanResidualMs: number;
  /** Spread of this visit's own arrivals about their mean, in milliseconds. */
  spreadMs: number;
}

export interface LatencyFit {
  /** Per-speaker arrival offset in milliseconds, relative to the first speaker. */
  offsetsMs: Record<string, number>;
  /** The phone audio clock against the server's, as a ratio. */
  rateRatio: number;
  /** The same reading as parts per million, which is how clocks are specified. */
  rateErrorPpm: number;
  /** Robust spread of the residuals across every used sample, in milliseconds. */
  residualMs: number;
  /**
   * The same spread taken one speaker at a time, in milliseconds.
   *
   * One figure for the run cannot tell a single spoiled speaker from detection
   * that was poor everywhere, and those want different things done about them.
   */
  scatterMs: Record<string, number>;
  /**
   * The longest gap between two readings of one speaker, or `null` when no
   * speaker was measured twice.
   *
   * This is what makes `d` mean anything. Measuring speakers one after another
   * makes a slowly drifting clock and a run of steadily growing latencies very
   * nearly the same shape, so within a single pass along the speakers `d` is
   * determined only by the few seconds each visit spans — far too short a
   * baseline to be worth anything. One speaker measured at both ends of the walk
   * gives it a baseline of the whole run.
   */
  bracketSpanSeconds: number | null;
  /**
   * How far the repeated readings of one speaker disagree, in milliseconds, or
   * `null` when nothing here can check them.
   *
   * Read the `null` carefully, because it is the usual case and it does not mean
   * agreement. A single repeated reading is the one constraint that *determines*
   * `d`; the fit then absorbs any disagreement between those two readings into
   * `d` exactly, and no residual is left behind to look at. A speaker whose
   * second reading is 6 ms out simply produces a clock rate 100 ppm further off —
   * perfectly ordinary for a phone — and every other offset quietly wrong.
   *
   * A number appears only once the readings outnumber what `d` can absorb: a
   * speaker measured three times, or two different speakers each measured twice.
   * Then one constraint fixes `d` and the rest genuinely test it.
   */
  bracketResidualMs: number | null;
  /**
   * How long the whole run took, on the phone's clock.
   *
   * The clock rate's uncertainty falls with the baseline it was measured over and
   * its effect on the offsets grows with the run, so this is what
   * {@link bracketSpanSeconds} has to be judged against.
   */
  runSpanSeconds: number;
  visits: VisitFit[];
  used: number;
  rejected: number;
}

/**
 * Arrivals this far apart or less are treated as equally good when deciding what
 * a visit's outliers are.
 *
 * Without a floor, a handful of unusually consistent arrivals shrinks the robust
 * spread to almost nothing and the pass throws away good samples.
 */
const RESIDUAL_FLOOR_SECONDS = 50e-6;

/**
 * And no further apart than this, however wide the visit's own spread is.
 *
 * The threshold is scaled off the data, so a badly detected visit widens it
 * until it swallows the very arrivals it exists to catch: at the 17 ms of spread
 * a spoiled walk produces it reaches 75 ms and rejects nothing. Sound covers two
 * thirds of a metre in this time and the matched filter resolves forty times
 * finer, so past here the pass stops taking the data's word for what is normal.
 */
const RESIDUAL_CEILING_SECONDS = 2e-3;

/** How many robust standard deviations an arrival may sit from its visit. */
const OUTLIER_SIGMAS = 3;

/** Below this many arrivals a visit's own spread is too noisy to judge by. */
const MIN_SAMPLES_TO_JUDGE = 5;

/**
 * The furthest a phone's audio clock can plausibly sit from the server's.
 *
 * Consumer crystals are specified inside ±100 ppm, and a run on a clock as far
 * out as 1000 ppm is still let through — so the line past which a rate stops
 * being a reading has to sit above what the rest of the flow tolerates. Twice that, and twenty times a healthy clock, refuses
 * nothing real while still catching a fit that has swallowed a whole chirp
 * period: one second misassigned across a two-and-a-half-minute walk implies some
 * 6600 ppm.
 *
 * That figure is one second divided by the run, so it falls as the walk gets
 * longer and crosses this line at about eight minutes. Past that length a
 * swallowed period is no longer absurd on its face, and this stops being able to
 * catch one.
 */
export const MAX_PLAUSIBLE_RATE_PPM = 2000;

/**
 * How far apart two speakers' latencies may be for the answer to be about the
 * room rather than about the order it was walked in.
 *
 * A latency is only ever known modulo the chirp period: an arrival half a period
 * late is the same recording as one half a period early against the following
 * chirp. While every speaker sits inside half a period of the others the arrivals
 * read one way only, and the answer is the room's. Past that it turns on which
 * speaker happened to be measured first and which silence the fold fell in, so
 * two walks of the same room can disagree.
 *
 * Half a period is the whole of what a chirp train has to say, so there is no
 * margin to be added here and nothing about the walk that would widen it.
 */
export const MAX_OFFSET_SPAN_MS = (CHIRP_PERIOD_SECONDS / 2) * 1000;

/**
 * Fit the arrivals, or return `null` when they cannot determine the model.
 *
 * Arrivals from a single instant, or too few of them to pin down both the clock
 * rate and every offset, leave the system singular; reporting nothing is the
 * only honest answer to that.
 *
 * A fit that should not be acted on is still returned rather than withheld: it is
 * the evidence for refusing the run, and `runVerdict` is where the refusal is
 * decided. Read {@link LatencyFit.offsetsMs} against {@link MAX_OFFSET_SPAN_MS}
 * and {@link LatencyFit.rateErrorPpm} against {@link MAX_PLAUSIBLE_RATE_PPM}
 * before trusting anything else here.
 */
export function fitLatencies(samples: ArrivalSample[]): LatencyFit | null {
  if (samples.length < 3) return null;

  const ordered = [...samples].sort((left, right) => left.at - right.at);
  const players = [...new Set(ordered.map((sample) => sample.playerId))];
  // The first speaker anchors the result: its offset is fixed at zero, so only
  // the others carry a free parameter.
  const free = players.slice(1);

  const rows = indexArrivals(groupByVisit(ordered), ordered[0].at);
  const used = rows.filter((row) => !row.outlier);
  if (used.length < free.length + 3) return null;

  const solution = solve(used, free);
  if (!solution) return null;

  return report(rows, used, solution, players);
}

/** One arrival with the terms the fit works in. */
interface FitRow {
  sample: ArrivalSample;
  /** Which chirp of the train this came from, counted from the run's first. */
  chirp: number;
  /** Recorded seconds since the run's first arrival. */
  elapsed: number;
  /** Set when this arrival did not agree with the rest of its own visit. */
  outlier: boolean;
}

/**
 * Number every arrival with the chirp that produced it, counting from the run's
 * first, and mark the arrivals that disagree with the rest of their own visit.
 *
 * A visit's arrivals are numbered against its first, which is a rounding over a
 * few seconds: only a detection wild enough to be an outlier anyway could land on
 * the wrong chirp. Each visit is then placed against the one before it, and that
 * is where the recording clock does the work — the silence in between was
 * recorded, not guessed, so the chirps that passed during it are that recording
 * divided by the period.
 *
 * What each rounding has to stay inside is half a period, and three things spend
 * it: the difference between the two speakers either side of the silence — 116 ms
 * between the widest pair seen in testing — the arrival detector's own bias, up to
 * 25 ms per visit against the grid it anchors on, and the drift across the silence
 * itself. Only drift grows with the walk, and on a healthy clock it is nothing:
 * 6 ms per minute of silence at 100 ppm, against a 500 ms budget. So there is
 * nothing here to choose between, which is why no search follows. The exception is
 * a clock as bad as the 1000 ppm the flow still admits, where a silence
 * spends 60 ms a minute and a long enough one could reach the budget on its own.
 *
 * Placing each visit against its neighbour rather than against the run's first
 * arrival is what keeps that budget per silence. Measured against one fixed
 * arrival the drift accumulates instead, and a phone 1000 ppm out spends the
 * whole budget on drift alone after eight minutes of walking.
 *
 * A visit is placed by the median of its arrivals rather than by its first, so a
 * reflection heard in place of the direct sound cannot shift every chirp number
 * that follows it.
 *
 * Outliers are judged inside a visit rather than against the finished fit,
 * because every arrival in a visit shares one speaker and one moment: a
 * reflection picked up instead of the direct sound stands out against its
 * neighbours, whereas against the global fit it has already dragged its own
 * speaker's offset towards itself and drags the honest arrivals out with it.
 */
function indexArrivals(visits: ArrivalSample[][], reference: number): FitRow[] {
  const rows: FitRow[] = [];

  let previous: number | null = null;
  let base = 0;

  for (const samples of visits) {
    const within = samples.map((sample) =>
      Math.round((sample.at - samples[0].at) / CHIRP_PERIOD_SECONDS),
    );
    // Where this visit's own first chirp sits on the recording, once per
    // arrival. They differ only by detection error and by the drift across the
    // visit, so their median is the visit's position.
    const origins = samples.map(
      (sample, arrival) => sample.at - within[arrival] * CHIRP_PERIOD_SECONDS,
    );
    const origin = median(origins);

    if (previous !== null)
      base += Math.round((origin - previous) / CHIRP_PERIOD_SECONDS);
    previous = origin;

    const outliers = findOutliers(origins.map((value) => value - origin));
    samples.forEach((sample, arrival) => {
      rows.push({
        sample,
        chirp: base + within[arrival],
        elapsed: sample.at - reference,
        outlier: outliers[arrival],
      });
    });
  }

  return rows;
}

/**
 * How far ahead of its own chirp an arrival was recorded, in seconds.
 *
 * Taking the chirp train back out leaves exactly what the fit is after: the
 * constant, the drift accumulated by then, and the speaker's own latency. It also
 * keeps the numbers small, so the drift is solved for directly instead of as a
 * ninth significant digit of an arrival time.
 */
function excess(row: FitRow): number {
  return row.elapsed - row.chirp * CHIRP_PERIOD_SECONDS;
}

/**
 * Flag the arrivals too far from their visit's own position to be the direct
 * sound, given each arrival's distance from it.
 *
 * A visit that would lose half its arrivals keeps all of them: at that point the
 * measurement is not one stray reflection but a bad recording, and the caller
 * needs to see that in the spread rather than have it quietly filtered away.
 */
function findOutliers(distances: number[]): boolean[] {
  if (distances.length < MIN_SAMPLES_TO_JUDGE)
    return distances.map(() => false);

  const spread = Math.min(
    RESIDUAL_CEILING_SECONDS,
    Math.max(RESIDUAL_FLOOR_SECONDS, robustSpread(distances)),
  );
  const limit = OUTLIER_SIGMAS * spread;

  const outliers = distances.map((value) => Math.abs(value) > limit);
  const rejected = outliers.filter(Boolean).length;
  return rejected * 2 > distances.length
    ? distances.map(() => false)
    : outliers;
}

/** Split arrivals into contiguous runs sharing a visit, keeping capture order. */
function groupByVisit(ordered: ArrivalSample[]): ArrivalSample[][] {
  const visits: ArrivalSample[][] = [];
  for (const sample of ordered) {
    const current = visits[visits.length - 1];
    if (current && current[0].visit === sample.visit) current.push(sample);
    else visits.push([sample]);
  }
  return visits;
}

/** The fitted parameters: the constant, the rate error, and one offset each. */
interface Solution {
  constant: number;
  drift: number;
  offsets: Map<string, number>;
}

/**
 * Least squares over the design `[1, served, ...speaker indicators]`, where
 * `served` is the server-clock time the arrival's chirp was emitted at.
 *
 * The parameter count is two plus the number of speakers after the first, so the
 * normal equations stay small enough that forming them directly costs nothing.
 */
function solve(rows: readonly FitRow[], free: string[]): Solution | null {
  const width = 2 + free.length;
  const column = new Map(free.map((playerId, index) => [playerId, 2 + index]));

  const normal = Array.from({ length: width }, () => new Float64Array(width));
  const target = new Float64Array(width);

  for (const row of rows) {
    const basis = new Float64Array(width);
    basis[0] = 1;
    basis[1] = row.chirp * CHIRP_PERIOD_SECONDS;
    const offset = column.get(row.sample.playerId);
    if (offset !== undefined) basis[offset] = 1;

    for (let i = 0; i < width; i++) {
      if (basis[i] === 0) continue;
      for (let j = 0; j < width; j++) normal[i][j] += basis[i] * basis[j];
      target[i] += basis[i] * excess(row);
    }
  }

  const solution = gaussian(normal, target);
  if (!solution) return null;

  return {
    constant: solution[0],
    drift: solution[1],
    offsets: new Map(
      free.map((playerId, index) => [playerId, solution[2 + index]]),
    ),
  };
}

/** Gauss-Jordan with partial pivoting; `null` when the system is singular. */
function gaussian(
  matrix: Float64Array[],
  vector: Float64Array,
): number[] | null {
  const width = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < width; pivot++) {
    let best = pivot;
    for (let row = pivot + 1; row < width; row++)
      if (Math.abs(rows[row][pivot]) > Math.abs(rows[best][pivot])) best = row;

    // A vanishing pivot means a parameter the arrivals cannot separate — a
    // speaker with no samples, or every sample taken at one instant.
    if (Math.abs(rows[best][pivot]) < 1e-12) return null;
    [rows[pivot], rows[best]] = [rows[best], rows[pivot]];

    const scale = rows[pivot][pivot];
    for (let column = pivot; column <= width; column++)
      rows[pivot][column] /= scale;

    for (let row = 0; row < width; row++) {
      if (row === pivot || rows[row][pivot] === 0) continue;
      const factor = rows[row][pivot];
      for (let column = pivot; column <= width; column++)
        rows[row][column] -= factor * rows[pivot][column];
    }
  }

  return rows.map((row) => row[width]);
}

/** The excess the model expects of this arrival, in seconds. */
function predict(row: FitRow, fit: Solution): number {
  return (
    fit.constant +
    fit.drift * row.chirp * CHIRP_PERIOD_SECONDS +
    (fit.offsets.get(row.sample.playerId) ?? 0)
  );
}

/** How far this arrival sits from the fitted line, in seconds. */
function residual(row: FitRow, fit: Solution): number {
  return excess(row) - predict(row, fit);
}

function report(
  rows: FitRow[],
  used: FitRow[],
  solution: Solution,
  players: string[],
): LatencyFit {
  const offsetsMs: Record<string, number> = {};
  for (const playerId of players)
    offsetsMs[playerId] = (solution.offsets.get(playerId) ?? 0) * 1000;

  const visits = summarizeVisits(rows, solution);

  return {
    offsetsMs,
    rateRatio: 1 + solution.drift,
    rateErrorPpm: solution.drift * 1e6,
    residualMs: robustSpread(used.map((row) => residual(row, solution))) * 1000,
    scatterMs: speakerScatter(used, solution, players),
    ...bracket(visits, rows),
    runSpanSeconds: rows.reduce(
      (longest, row) => Math.max(longest, row.elapsed),
      0,
    ),
    visits,
    used: used.length,
    rejected: rows.length - used.length,
  };
}

/** Each speaker's own arrivals against the fitted line, in milliseconds. */
function speakerScatter(
  used: readonly FitRow[],
  fit: Solution,
  players: string[],
): Record<string, number> {
  const residuals = new Map(
    players.map((playerId) => [playerId, [] as number[]]),
  );
  for (const row of used)
    residuals.get(row.sample.playerId)?.push(residual(row, fit));

  const scatterMs: Record<string, number> = {};
  for (const [playerId, values] of residuals)
    scatterMs[playerId] = robustSpread(values) * 1000;
  return scatterMs;
}

function summarizeVisits(rows: FitRow[], fit: Solution): VisitFit[] {
  return groupRows(rows).map((group) => {
    const kept = group.filter((row) => !row.outlier);
    const judged = kept.length ? kept : group;
    const residuals = judged.map((row) => residual(row, fit));
    const mean =
      residuals.reduce((total, value) => total + value, 0) / residuals.length;

    return {
      visit: group[0].sample.visit,
      playerId: group[0].sample.playerId,
      samples: group.length,
      used: kept.length,
      meanResidualMs: mean * 1000,
      spreadMs:
        Math.sqrt(
          residuals.reduce((total, value) => total + (value - mean) ** 2, 0) /
            residuals.length,
        ) * 1000,
    };
  });
}

/** The fitted rows regrouped per visit, in the order they were captured. */
function groupRows(rows: FitRow[]): FitRow[][] {
  const groups: FitRow[][] = [];
  for (const row of rows) {
    const current = groups[groups.length - 1];
    if (current && current[0].sample.visit === row.sample.visit)
      current.push(row);
    else groups.push([row]);
  }
  return groups;
}

/**
 * Work out what the repeated readings in this run can and cannot say.
 *
 * The span comes from whichever speaker was measured twice furthest apart, since
 * that is the baseline `d` rests on. The prescribed walk re-measures the first
 * speaker last, so that is normally the pair; picking by span rather than by name
 * means a run that brackets a different speaker still counts.
 *
 * A disagreement is only reported once there are more repeated readings than `d`
 * has freedom to absorb. Every repeat past the first is one such constraint, so
 * two of them leave something over to check against — and one does not, however
 * badly the two readings actually disagree.
 */
function bracket(
  visits: VisitFit[],
  rows: FitRow[],
): { bracketSpanSeconds: number | null; bracketResidualMs: number | null } {
  const at = new Map<number, number>();
  for (const row of rows)
    if (!at.has(row.sample.visit)) at.set(row.sample.visit, row.elapsed);

  let span: number | null = null;
  let constraints = 0;
  let worst = 0;

  for (const playerId of new Set(visits.map((visit) => visit.playerId))) {
    const repeated = visits.filter((visit) => visit.playerId === playerId);
    if (repeated.length < 2) continue;
    constraints += repeated.length - 1;

    const first = repeated[0];
    const last = repeated[repeated.length - 1];
    const gap = Math.abs(
      (at.get(last.visit) ?? 0) - (at.get(first.visit) ?? 0),
    );
    if (span === null || gap > span) span = gap;

    const residuals = repeated.map((visit) => visit.meanResidualMs);
    worst = Math.max(worst, Math.max(...residuals) - Math.min(...residuals));
  }

  return {
    bracketSpanSeconds: span,
    bracketResidualMs: constraints >= 2 ? worst : null,
  };
}

/** Median absolute deviation, scaled to read as a standard deviation. */
function robustSpread(values: readonly number[]): number {
  const centre = median(values);
  return 1.4826 * median(values.map((value) => Math.abs(value - centre)));
}

function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
