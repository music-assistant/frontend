import { CHIRP_PERIOD_SECONDS } from "@/helpers/sendspin-sync/chirp";
import { MAX_SPACING_ERROR } from "@/helpers/sendspin-sync/chirpSpacing";
import {
  MAX_OFFSET_SPAN_MS,
  type LatencyFit,
  type VisitFit,
} from "@/helpers/sendspin-sync/latencyFit";
import {
  isApplicable,
  MAX_LOST_FRACTION,
  offsetSpanMs,
  runVerdict,
  worstSpreadMs,
  type CaptureLoss,
} from "@/helpers/sendspin-sync/verdict";
import { describe, expect, it } from "vitest";

const SELECTED = ["living", "kitchen"];

/** A run whose recordings heard everything, which one case below spoils. */
const CLEAN: CaptureLoss = { dropouts: 0, worstFraction: 0 };

/** The spacing a server in step with this build emits at. */
const IN_STEP = CHIRP_PERIOD_SECONDS;

function visit(overrides: Partial<VisitFit> = {}): VisitFit {
  return {
    visit: 0,
    playerId: "living",
    samples: 10,
    used: 10,
    meanResidualMs: 0,
    spreadMs: 0.05,
    ...overrides,
  };
}

/** A run that came out well, which each case below spoils in one way. */
function fitFixture(overrides: Partial<LatencyFit> = {}): LatencyFit {
  return {
    offsetsMs: { living: 0, kitchen: 12 },
    rateRatio: 1.00004,
    rateErrorPpm: 40,
    residualMs: 0.05,
    scatterMs: { living: 0.05, kitchen: 0.05 },
    bracketSpanSeconds: 90,
    bracketResidualMs: null,
    runSpanSeconds: 100,
    visits: [visit(), visit({ visit: 1, playerId: "kitchen" })],
    used: 20,
    rejected: 0,
    ...overrides,
  };
}

describe("runVerdict", () => {
  it("says the rate is pinned when one repeat set it and nothing is wrong", () => {
    const verdict = runVerdict(fitFixture(), SELECTED, CLEAN, IN_STEP);

    expect(verdict).toBe("pinned");
    expect(isApplicable(verdict)).toBe(true);
  });

  it("names a server out of step with this build, ahead of everything", () => {
    // A server still emitting twice as often as this build expects. Every arrival
    // is then counted against the wrong chirp, and the readings that come out are
    // exactly the ones below: an impossible clock, speakers that cannot be placed,
    // arrivals nowhere near the line. All of those would send the reader to the
    // phone, the speakers or the walk, and the fault is in none of them.
    const verdict = runVerdict(
      fitFixture({
        offsetsMs: { living: 0, kitchen: 600 },
        rateErrorPpm: -6637.4,
        residualMs: 17.03,
      }),
      SELECTED,
      { dropouts: 96, worstFraction: 0.045 },
      CHIRP_PERIOD_SECONDS / 2,
    );

    expect(verdict).toBe("mismatched");
    expect(isApplicable(verdict)).toBe(false);
  });

  it("names a server emitting slower than this build expects just the same", () => {
    expect(
      runVerdict(fitFixture(), SELECTED, CLEAN, CHIRP_PERIOD_SECONDS * 2),
    ).toBe("mismatched");
  });

  it("lets the stretch a phone's own clock puts on the spacing through", () => {
    // The worst clock the flow admits reads the spacing a thousandth long, and
    // refusing that would refuse every run on a merely poor phone.
    expect(
      runVerdict(
        fitFixture(),
        SELECTED,
        CLEAN,
        CHIRP_PERIOD_SECONDS * (1 + 1e-3),
      ),
    ).toBe("pinned");
    expect(
      runVerdict(
        fitFixture(),
        SELECTED,
        CLEAN,
        CHIRP_PERIOD_SECONDS * (1 + MAX_SPACING_ERROR * 2),
      ),
    ).toBe("mismatched");
  });

  it("holds nothing against a run whose spacing could not be read", () => {
    // No recording could make out a chirp train — every speaker was silent, or too
    // faint. That is not agreement with this build, but it is not evidence against
    // it either, and the run has to be judged on what it does show.
    expect(runVerdict(fitFixture(), SELECTED, CLEAN, null)).toBe("pinned");
    expect(
      runVerdict(
        fitFixture({ offsetsMs: { living: 0 } }),
        SELECTED,
        CLEAN,
        null,
      ),
    ).toBe("unmeasured");
  });

  it("blames the recording before anything the recording was of", () => {
    // A phone that dropped this much audio produces exactly the readings below —
    // speakers that cannot be placed, an impossible clock, arrivals all over the
    // line. Every one of those verdicts would send the reader to the speakers or
    // to how they walked, and none of it is the fault.
    const verdict = runVerdict(
      fitFixture({
        offsetsMs: { living: 0, kitchen: 600 },
        rateErrorPpm: -6868,
        residualMs: 14,
      }),
      SELECTED,
      { dropouts: 96, worstFraction: 0.045 },
      IN_STEP,
    );

    expect(verdict).toBe("lossy");
    expect(isApplicable(verdict)).toBe(false);
  });

  it("lets a recording with the odd hole in it through", () => {
    // Holes are measured against the render clock and keep their length, so a few
    // cost nothing but the chirps that fell in them. These two sit either side of
    // where enough have gone missing for that to stop being true.
    expect(
      runVerdict(
        fitFixture(),
        SELECTED,
        {
          dropouts: 15,
          worstFraction: MAX_LOST_FRACTION,
        },
        IN_STEP,
      ),
    ).toBe("pinned");
    expect(
      runVerdict(
        fitFixture(),
        SELECTED,
        {
          dropouts: 25,
          worstFraction: MAX_LOST_FRACTION * 1.5,
        },
        IN_STEP,
      ),
    ).toBe("lossy");
  });

  it("judges the worst recording, not the run's total", () => {
    // One spoiled reading moves the speaker it belongs to, however many clean
    // recordings surround it — so the count says a lot happened and the fraction
    // is what decides.
    expect(
      runVerdict(
        fitFixture(),
        SELECTED,
        {
          dropouts: 400,
          worstFraction: 0.004,
        },
        IN_STEP,
      ),
    ).toBe("pinned");
  });

  it("refuses speakers further apart than a chirp train can place, first of all", () => {
    // Half a period is the whole of what the chirp train has to say, so past it
    // the offsets are one reading of the recording rather than the reading — and
    // the impossible rate this also shows up as is the same fault at one remove.
    const verdict = runVerdict(
      fitFixture({
        offsetsMs: { living: 0, kitchen: 600 },
        rateErrorPpm: -6637.4,
      }),
      SELECTED,
      CLEAN,
      IN_STEP,
    );

    expect(verdict).toBe("unindexable");
    expect(isApplicable(verdict)).toBe(false);
  });

  it("lets speakers just inside half a period through", () => {
    // The limit is the measurement's own edge rather than a judgement about how
    // good a run is, so these two sit either side of it.
    expect(
      runVerdict(
        fitFixture({ offsetsMs: { living: 0, kitchen: 490 } }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("pinned");
    expect(
      runVerdict(
        fitFixture({ offsetsMs: { living: 0, kitchen: 510 } }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("unindexable");
  });

  it("refuses a span sitting exactly on half a period", () => {
    // Half a period is the one span where an arrival is as close to the next
    // chirp as to its own, so the rounding that placed it was a coin flip. It is
    // refused rather than admitted, which is what "inside half a period" means.
    expect(
      runVerdict(
        fitFixture({
          offsetsMs: { living: 0, kitchen: MAX_OFFSET_SPAN_MS },
        }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("unindexable");
  });

  it("refuses a rate no clock could have, ahead of everything else", () => {
    // One chirp period misassigned across a two and a half minute walk, landing
    // on the anchor where the offsets cannot show it. Worst first, and this is
    // the worst there is: the missing speaker and the scatter this run also shows
    // are symptoms rather than the fault.
    const verdict = runVerdict(
      fitFixture({
        rateErrorPpm: -6637.4,
        offsetsMs: { living: 0 },
        residualMs: 17.03,
      }),
      SELECTED,
      CLEAN,
      IN_STEP,
    );

    expect(verdict).toBe("irreconcilable");
    expect(isApplicable(verdict)).toBe(false);
  });

  it("lets a poor but possible clock through to the other checks", () => {
    // The microphone probe calls 1000 ppm degraded and still lets the run go
    // ahead, so the refusal has to sit above it rather than duplicate it.
    expect(
      runVerdict(fitFixture({ rateErrorPpm: 1000 }), SELECTED, CLEAN, IN_STEP),
    ).toBe("pinned");
  });

  it("names an unheard speaker ahead of anything else that is wrong", () => {
    // Worst first: a missing speaker makes the whole result actively harmful, so
    // it is reported even though this run is also unbracketed and scattered.
    const verdict = runVerdict(
      fitFixture({
        offsetsMs: { living: 0 },
        bracketSpanSeconds: null,
        residualMs: 9,
      }),
      SELECTED,
      CLEAN,
      IN_STEP,
    );

    expect(verdict).toBe("unmeasured");
    expect(isApplicable(verdict)).toBe(false);
  });

  it("refuses a run where nothing was measured twice", () => {
    expect(
      runVerdict(
        fitFixture({ bracketSpanSeconds: null }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("unbracketed");
  });

  it("refuses a bracket too short to pin the rate over the run", () => {
    // Half the run is the bar, so these two sit either side of it.
    expect(
      runVerdict(
        fitFixture({ bracketSpanSeconds: 40, runSpanSeconds: 100 }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("short_bracket");
    expect(
      runVerdict(
        fitFixture({ bracketSpanSeconds: 60, runSpanSeconds: 100 }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("pinned");
  });

  it("refuses a run whose arrivals do not sit on the line", () => {
    expect(
      runVerdict(fitFixture({ residualMs: 1.5 }), SELECTED, CLEAN, IN_STEP),
    ).toBe("scattered");
  });

  it("catches one spoiled reading the run-wide figure cannot see", () => {
    // `residualMs` is a median across every arrival, so a single bad speaker out
    // of several leaves it untouched. Its own spread is what shows it up.
    const verdict = runVerdict(
      fitFixture({
        residualMs: 0.05,
        visits: [
          visit(),
          visit({ visit: 1, playerId: "kitchen", spreadMs: 4 }),
        ],
      }),
      SELECTED,
      CLEAN,
      IN_STEP,
    );

    expect(verdict).toBe("scattered");
    expect(isApplicable(verdict)).toBe(false);
  });

  it("reports a genuine cross-check, in both directions", () => {
    expect(
      runVerdict(
        fitFixture({ bracketResidualMs: 0.4 }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("checked");
    expect(
      runVerdict(
        fitFixture({ bracketResidualMs: 2 }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("disagrees");
  });

  it("prefers a disagreement over the scatter it also causes", () => {
    // Repeats that disagree also widen the scatter, and "walk it again" is more
    // use to the reader than "something moved".
    expect(
      runVerdict(
        fitFixture({ bracketResidualMs: 3, residualMs: 2 }),
        SELECTED,
        CLEAN,
        IN_STEP,
      ),
    ).toBe("disagrees");
  });

  it("only lets a pinned or checked run be applied", () => {
    expect(isApplicable("pinned")).toBe(true);
    expect(isApplicable("checked")).toBe(true);
    for (const verdict of [
      "mismatched",
      "lossy",
      "unindexable",
      "irreconcilable",
      "unmeasured",
      "unbracketed",
      "short_bracket",
      "scattered",
      "disagrees",
    ] as const)
      expect(isApplicable(verdict)).toBe(false);
  });
});

describe("offsetSpanMs", () => {
  it("spans every speaker, the anchor's own zero included", () => {
    // The anchor is what the others are read against, so a run where everything
    // sits behind it is as wide as its furthest speaker.
    expect(
      offsetSpanMs(fitFixture({ offsetsMs: { living: 0, kitchen: 260 } })),
    ).toBe(260);
    // And one that straddles the anchor is as wide as both sides together, which
    // is the figure the limit is about.
    expect(
      offsetSpanMs(
        fitFixture({ offsetsMs: { living: 0, kitchen: 200, study: -120 } }),
      ),
    ).toBe(320);
  });

  it("is zero when only the anchor was heard", () => {
    expect(offsetSpanMs(fitFixture({ offsetsMs: { living: 0 } }))).toBe(0);
    expect(offsetSpanMs(fitFixture({ offsetsMs: {} }))).toBe(0);
  });

  it("stays inside the limit on a run that came out well", () => {
    expect(offsetSpanMs(fitFixture())).toBeLessThan(MAX_OFFSET_SPAN_MS);
  });
});

describe("worstSpreadMs", () => {
  it("is the widest spread of any single reading", () => {
    expect(
      worstSpreadMs(
        fitFixture({
          visits: [
            visit({ spreadMs: 0.2 }),
            visit({ visit: 1, spreadMs: 3.5 }),
          ],
        }),
      ),
    ).toBe(3.5);
  });

  it("is zero when there is nothing to judge", () => {
    expect(worstSpreadMs(fitFixture({ visits: [] }))).toBe(0);
  });
});
