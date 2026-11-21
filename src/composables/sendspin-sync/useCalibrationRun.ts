/**
 * The calibration walk, from picking speakers to applying the result.
 *
 * Holds the flow together: the server session that plays the chirps, the
 * microphone that hears them, and the fit that turns arrivals into one latency
 * per speaker. The view reads the state this exposes and calls the four verbs;
 * none of the timing rules live up there.
 *
 * The walk deliberately ends by measuring the first speaker a second time. Every
 * speaker is measured in its own few-second window, one after another, which
 * makes a slowly drifting phone clock and a run of steadily growing latencies
 * very nearly the same shape — so on a single pass the clock rate is separable
 * from the offsets only over the few seconds one visit spans, which is nowhere
 * near enough. Measuring one speaker at both ends of the walk gives it the whole
 * run as a baseline, and without that the result is not offered for applying.
 *
 * That first repeat *determines* the rate rather than testing it: the fit absorbs
 * any disagreement between the two readings into the rate exactly, leaving no
 * residual behind. Measuring a second speaker twice is what makes the rate
 * testable, so the flow invites it without demanding it — and what is being
 * checked, or not, is said plainly rather than implied by a number that would read
 * as a pass either way.
 */

import { CHIRP_PERIOD_SECONDS } from "@/helpers/sendspin-sync/chirp";
import { scanArrivals } from "@/helpers/sendspin-sync/chirpArrivals";
import {
  fitLatencies,
  type ArrivalSample,
  type LatencyFit,
} from "@/helpers/sendspin-sync/latencyFit";
import {
  isApplicable,
  MIN_BRACKET_FRACTION,
  runVerdict,
  type CaptureLoss,
} from "@/helpers/sendspin-sync/verdict";
import type { CalibrationApplyResult } from "@/plugins/api/interfaces";
import { computed, onScopeDispose, ref, watch } from "vue";
import { useCalibrationSession } from "./useCalibrationSession";
import { useChirpCapture } from "./useChirpCapture";

/**
 * Chirps collected per speaker.
 *
 * Every one of them costs a second of standing still, so this is as few as the
 * rest of the flow can work with rather than as many as would fit. Two things set
 * the floor, and neither is precision — a clean visit's arrivals agree to a
 * hundredth of a millisecond, which is a hundred times finer than the run is
 * judged by. What needs funding is the outlier pass that throws away a reflection
 * heard in place of the direct sound: it wants five arrivals before it will judge
 * a visit at all, and a recording at the edge of the loss the verdict admits
 * expects to have two of them nicked by holes. Seven leaves exactly that margin.
 */
const CHIRPS_PER_VISIT = 7;

/**
 * How long to wait after soloing before recording.
 *
 * The server unmutes the speaker being measured and then mutes the others, so the
 * first chirp periods after a solo still carry the speaker that was audible
 * before. Those have to be thrown away rather than measured.
 */
const SETTLE_SECONDS = 1;

/** Long enough for {@link CHIRPS_PER_VISIT} chirps wherever the first one lands. */
const RECORD_SECONDS = (CHIRPS_PER_VISIT + 1) * CHIRP_PERIOD_SECONDS;

/** A speaker measured once. */
export interface Measurement {
  visit: number;
  playerId: string;
  /** Chirps found, against the number the recording was long enough to hold. */
  found: number;
  expected: number;
  /** Typical peak-to-noise ratio of those arrivals. */
  medianSnr: number;
  /** Render quanta of this recording nothing was heard for. */
  dropouts: number;
  /** The share of this recording those quanta cover, 0 to 1. */
  lostFraction: number;
}

export type RunPhase = "picking" | "walking" | "measuring" | "voided";

export function useCalibrationRun() {
  const session = useCalibrationSession();
  const capture = useChirpCapture();

  const phase = ref<RunPhase>("picking");
  const selected = ref<string[]>([]);
  const visits = ref<Measurement[]>([]);
  const applyResult = ref<CalibrationApplyResult | null>(null);
  const openError = ref<string | null>(null);
  /** The speaker currently being recorded, so the view can show it where it is. */
  const measuringPlayerId = ref<string | null>(null);
  /** Seconds left of the reading in progress, for the user standing still. */
  const secondsLeft = ref(0);
  /** True between the tap on Start and the session being up, or refused. */
  const starting = ref(false);
  /**
   * True while the walk is being repeated over the delays just applied.
   *
   * Those readings are of corrected speakers, so they are kept apart from the
   * ones the correction was worked out from: one fit over both would see every
   * speaker jump part-way through.
   */
  const verifying = ref(false);

  const samples = ref<ArrivalSample[]>([]);
  let nextVisit = 0;
  let countdown: ReturnType<typeof setInterval> | null = null;

  /**
   * The speaker every other reading is relative to, and the one to re-measure.
   *
   * Whichever speaker was heard first, rather than whichever was ticked first:
   * the fit fixes its offset at zero by the order the arrivals came in, and the
   * walk is free to visit the speakers in any order at all. A reading that heard
   * nothing put no arrivals in, so it is no reference. `null` until there is a
   * reading, because until then nothing is a reference yet.
   */
  const anchor = computed(
    () => visits.value.find((visit) => visit.found > 0)?.playerId ?? null,
  );

  const measured = computed(
    () => new Set(visits.value.map((visit) => visit.playerId)),
  );
  const remaining = computed(() =>
    selected.value.filter((playerId) => !measured.value.has(playerId)),
  );

  /**
   * True once every speaker is done but the bracketing re-measure is not.
   *
   * Two readings of one speaker are not enough on their own: taken moments apart
   * they pin the clock rate over seconds rather than over the walk, which is no
   * better than not bracketing at all. So this keeps asking until the bracket
   * actually spans the run.
   */
  const needsBracket = computed(() => {
    if (remaining.value.length > 0) return false;
    const current = fit.value;
    if (!current || current.bracketSpanSeconds === null) return true;
    return (
      current.bracketSpanSeconds < MIN_BRACKET_FRACTION * current.runSpanSeconds
    );
  });

  /**
   * True once one more repeat would turn a run that only pins the clock rate
   * into one that tests it.
   *
   * `pinned` is exactly that state and nothing else is: the rate rests on a
   * single repeat, which the fit absorbs whole and so cannot also check. Every
   * other verdict has either been checked already or has something wrong with it
   * that another reading would not answer.
   */
  const needsCheck = computed(() => verdict.value === "pinned");

  const fit = computed<LatencyFit | null>(() => fitLatencies(samples.value));

  /**
   * What the run's recordings lost between them.
   *
   * The worst single recording rather than an average: one spoiled reading is
   * enough to move the speaker it belongs to, and a run-wide figure would bury it
   * under however many clean recordings surround it.
   */
  const loss = computed<CaptureLoss>(() => ({
    dropouts: visits.value.reduce((total, visit) => total + visit.dropouts, 0),
    worstFraction: visits.value.reduce(
      (worst, visit) => Math.max(worst, visit.lostFraction),
      0,
    ),
  }));

  /** What this run can honestly say about itself, or `null` before it can. */
  const verdict = computed(() =>
    fit.value ? runVerdict(fit.value, selected.value, loss.value) : null,
  );

  /** Whether the offsets may be applied. */
  const trustworthy = computed(() =>
    verdict.value ? isApplicable(verdict.value) : false,
  );

  // A context that stopped leaves the arrivals either side of the gap on
  // unrelated timelines, so the run is over whenever this fires. Nothing of it
  // can be used, so the speakers go back at once rather than staying silent
  // until somebody reads the screen. A release that fails here is not lost: the
  // session keeps it, and starting over asks the server again.
  watch(capture.voided, (voided) => {
    if (!voided) return;
    phase.value = "voided";
    void finish();
  });
  watch(session.lost, (lost) => {
    if (!lost) return;
    phase.value = "voided";
    void capture.close();
  });

  /**
   * Load the speakers on offer, and untick the ones that can no longer start.
   *
   * A speaker that left the list has no row to untick it on, and one that went
   * silent has a checkbox that is switched off, so a tick left on either would
   * count towards the minimum and then be refused by the server.
   */
  async function loadPlayers(): Promise<boolean> {
    if (!(await session.loadPlayers())) return false;
    const startable = new Set(
      session.players.value
        .filter((player) => !player.silent)
        .map((player) => player.player_id),
    );
    selected.value = selected.value.filter((id) => startable.has(id));
    return true;
  }

  /**
   * Take the selected speakers over, open the microphone, and start walking.
   *
   * Must be called straight from a user gesture so the browser counts the tap as
   * permission to open an `AudioContext`.
   *
   * A start the server refuses leaves the page where it was, with the reason in
   * the session's `problem`: a speaker that is muted is put right in a moment,
   * and is no reason to send the user back through anything.
   */
  async function begin(force = false): Promise<boolean> {
    if (phase.value !== "picking" || selected.value.length < 2) return false;
    if (starting.value) return false;
    starting.value = true;

    try {
      const opening = await capture.open();
      if (!opening.opened) {
        openError.value = opening.error?.name ?? "OpenFailed";
        return false;
      }
      openError.value = null;

      if (!(await session.start(selected.value, force))) {
        await capture.close();
        return false;
      }

      phase.value = "walking";
      return true;
    } finally {
      starting.value = false;
    }
  }

  /**
   * Measure one speaker: make it audible, let it settle, then listen.
   *
   * `replace` throws that speaker's latest reading away first, for one the user
   * is taking again because it came out badly. Without it the reading is added,
   * which is what the closing steps of the walk ask for: a second reading of a
   * speaker is what the clock drift is worked out from.
   */
  async function measure(playerId: string, replace = false): Promise<boolean> {
    if (phase.value !== "walking") return false;
    phase.value = "measuring";
    measuringPlayerId.value = playerId;

    try {
      if (!(await session.solo(playerId))) return false;
      startCountdown();
      await settle();
      if (capture.voided.value) return false;

      const recording = await capture.record(RECORD_SECONDS);
      if (!recording) return false;
      if (replace) forgetLatest(playerId);

      const scan = scanArrivals(recording.samples, {
        sampleRate: recording.sampleRate,
        firstFrame: recording.firstFrame,
      });

      const visit = nextVisit++;
      samples.value = [
        ...samples.value,
        ...scan.arrivals.map((arrival) => ({
          visit,
          playerId,
          at: arrival.at,
        })),
      ];
      visits.value = [
        ...visits.value,
        {
          visit,
          playerId,
          found: scan.arrivals.length,
          expected: scan.expected,
          medianSnr: scan.medianSnr,
          dropouts: recording.dropouts,
          lostFraction: recording.samples.length
            ? recording.lostFrames / recording.samples.length
            : 0,
        },
      ];
      // The user is looking at the room, not the screen.
      navigator.vibrate?.(200);
      return scan.arrivals.length > 0;
    } finally {
      stopCountdown();
      measuringPlayerId.value = null;
      // A void that landed mid-measurement must not be overwritten back to a
      // state that invites another one.
      if (phase.value === "measuring")
        phase.value =
          capture.voided.value || session.lost.value ? "voided" : "walking";
    }
  }

  /** Drop the most recent reading of one speaker, and the arrivals it put in. */
  function forgetLatest(playerId: string): void {
    const latest = visits.value.findLast(
      (visit) => visit.playerId === playerId,
    );
    if (!latest) return;
    visits.value = visits.value.filter((visit) => visit !== latest);
    samples.value = samples.value.filter(
      (sample) => sample.visit !== latest.visit,
    );
  }

  /**
   * Throw every reading away and walk again, on the same session and microphone.
   *
   * For a walk that went wrong in a way no single reading puts right. The
   * recording has run without a gap since the start, so new readings stand on
   * the same timeline and nothing has to be opened again.
   */
  function clearReadings(): void {
    if (phase.value !== "walking") return;
    visits.value = [];
    samples.value = [];
    nextVisit = 0;
  }

  /** Hand the offsets to the server, and keep the delays it worked out. */
  async function apply(): Promise<boolean> {
    const offsets = fit.value?.offsetsMs;
    if (!offsets || !trustworthy.value) return false;

    const result = await session.apply(offsets);
    if (!result) return false;

    applyResult.value = result;
    return true;
  }

  /**
   * Walk the speakers again over the delays that were just applied.
   *
   * The speakers have their corrections now, so a second walk shows whether
   * they landed: every speaker should read about the same as the first one.
   */
  function verify(): void {
    if (phase.value !== "walking" || !applyResult.value) return;
    visits.value = [];
    samples.value = [];
    nextVisit = 0;
    applyResult.value = null;
    verifying.value = true;
  }

  /** End the run: stop the session, release the microphone. */
  async function finish(): Promise<boolean> {
    const released = await session.stop();
    await capture.close();
    return released;
  }

  /** End a session found running that was not started from this page. */
  function endAdopted(): Promise<boolean> {
    return session.stop(true);
  }

  /**
   * Throw the run away and go back to picking speakers.
   *
   * Used after a void, where nothing measured so far can be salvaged: the
   * arrivals either side of the gap have no common time base, so keeping any of
   * them would only make the next fit wrong in a way nothing would show.
   *
   * Returns whether the speakers were given back, see `stop` of the session.
   */
  async function restart(): Promise<boolean> {
    const released = await finish();
    capture.reset();
    session.reset();
    visits.value = [];
    samples.value = [];
    nextVisit = 0;
    applyResult.value = null;
    openError.value = null;
    verifying.value = false;
    phase.value = "picking";
    return released;
  }

  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, SETTLE_SECONDS * 1000));
  }

  /** Count the reading down, settling time included, a second at a time. */
  function startCountdown(): void {
    stopCountdown();
    secondsLeft.value = Math.ceil(SETTLE_SECONDS + RECORD_SECONDS);
    countdown = setInterval(() => {
      secondsLeft.value = Math.max(0, secondsLeft.value - 1);
    }, 1000);
  }

  function stopCountdown(): void {
    if (countdown !== null) clearInterval(countdown);
    countdown = null;
    secondsLeft.value = 0;
  }

  onScopeDispose(stopCountdown);

  return {
    // server state
    players: session.players,
    sessionState: session.state,
    sessionOwned: session.owned,
    sessionLost: session.lost,
    sessionProblem: session.problem,
    busy: session.busy,
    loadPlayers,
    refresh: session.refresh,
    // capture state
    voided: capture.voided,
    recording: capture.recording,
    sampleRate: capture.sampleRate,
    openError,
    // the walk
    phase,
    selected,
    visits,
    measuringPlayerId,
    secondsLeft,
    starting,
    verifying,
    anchor,
    remaining,
    needsBracket,
    needsCheck,
    fit,
    loss,
    verdict,
    trustworthy,
    applyResult,
    begin,
    measure,
    clearReadings,
    apply,
    verify,
    finish,
    endAdopted,
    restart,
  };
}
