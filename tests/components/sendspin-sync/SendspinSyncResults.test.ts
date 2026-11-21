import SendspinSyncResults from "@/components/sendspin-sync/SendspinSyncResults.vue";
import type { LatencyFit } from "@/helpers/sendspin-sync/latencyFit";
import { runVerdict, type CaptureLoss } from "@/helpers/sendspin-sync/verdict";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

const PLAYERS = [
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
];

const BASE = "providers.sendspin.calibration.results";
const MANUAL = "providers.sendspin.calibration.manual";

function fitFixture(overrides: Partial<LatencyFit> = {}): LatencyFit {
  return {
    offsetsMs: { living: 0, kitchen: 12.345 },
    rateRatio: 1.00004,
    rateErrorPpm: 40,
    residualMs: 0.03,
    scatterMs: { living: 0.02, kitchen: 0.04 },
    bracketSpanSeconds: 90,
    bracketResidualMs: null,
    runSpanSeconds: 100,
    visits: [],
    used: 30,
    rejected: 1,
    ...overrides,
  };
}

/** A run whose recordings heard everything, which one case below spoils. */
const CLEAN: CaptureLoss = { dropouts: 0, worstFraction: 0 };

function mountResults(
  props: Partial<InstanceType<typeof SendspinSyncResults>["$props"]> = {},
) {
  return mount(SendspinSyncResults, {
    props: {
      players: PLAYERS,
      selected: ["living", "kitchen"],
      fit: fitFixture(),
      loss: CLEAN,
      // Derived rather than hand-set, so a test cannot describe a run the verdict
      // helper would never actually produce.
      verdict: runVerdict(
        (props.fit as LatencyFit | undefined) ?? fitFixture(),
        ["living", "kitchen"],
        (props.loss as CaptureLoss | undefined) ?? CLEAN,
      ),
      applyResult: null,
      trustworthy: true,
      anchor: "living",
      disabled: false,
      ...props,
    },
    global: {
      mocks: {
        // The values are rendered alongside the key, because a per-speaker
        // figure that named the wrong speaker would match the key on its own.
        $t: (key: string, values?: unknown[]) =>
          values ? `${key} ${values.join(" ")}` : key,
      },
    },
  });
}

/** A button by the one string it shows. */
function buttonSaying(wrapper: ReturnType<typeof mountResults>, key: string) {
  return wrapper.findAll("button").find((button) => button.text() === key);
}

/** The Apply button, which is absent altogether on a run that cannot be applied. */
function applyButton(wrapper: ReturnType<typeof mountResults>) {
  return buttonSaying(wrapper, `${BASE}.apply`);
}

/**
 * The button that gives the speakers back, which is offered whatever the run
 * came to. It reads as the next step once the delays are in.
 */
function finishButton(wrapper: ReturnType<typeof mountResults>) {
  return (buttonSaying(wrapper, `${BASE}.finish`) ??
    buttonSaying(wrapper, `${BASE}.done`))!;
}

describe("SendspinSyncResults", () => {
  it("shows one offset per speaker, by name", () => {
    const rows = mountResults().findAll("li");

    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("Living room");
    expect(rows[1].text()).toContain("Kitchen");
  });

  it("says the rate was pinned, not checked, when one repeat set it", () => {
    const wrapper = mountResults();

    // The usual case, and the one most easily misread: a single repeat determines
    // the clock rate and so cannot also test it.
    expect(wrapper.text()).toContain(`${BASE}.check.pinned.title`);
    expect(applyButton(wrapper)!.attributes("disabled")).toBeUndefined();
  });

  it("asks for a second reading when nothing was measured twice", () => {
    const wrapper = mountResults({
      fit: fitFixture({ bracketSpanSeconds: null }),
      trustworthy: false,
    });

    expect(wrapper.text()).toContain(`${BASE}.check.unbracketed.title`);
    expect(applyButton(wrapper)).toBeUndefined();
  });

  it("reports what the recording lost, alongside the chirps it used", () => {
    const wrapper = mountResults({
      loss: { dropouts: 7, worstFraction: 0.003 },
    });

    // A thin arrival count is explained by a recording with holes in it, and
    // there is nothing else on the panel that would say so.
    expect(wrapper.text()).toContain(`${BASE}.gaps`);
    expect(wrapper.text()).toContain(`${BASE}.lost 7 0.3`);
  });

  it("blames the phone's recording, not the speakers, when it had gaps", () => {
    const wrapper = mountResults({
      // The reported walk: an impossible rate and scatter everywhere, all of it
      // downstream of a phone that dropped four and a half per cent of a reading.
      fit: fitFixture({ rateErrorPpm: -6868, residualMs: 14 }),
      loss: { dropouts: 96, worstFraction: 0.045 },
      trustworthy: false,
    });

    expect(wrapper.text()).toContain(`${BASE}.check.lossy.title`);
    expect(wrapper.text()).toContain(`${BASE}.check.lossy.description 4.5 1`);
    expect(applyButton(wrapper)).toBeUndefined();
  });

  it("blames the scatter when the arrivals do not sit on the line", () => {
    const wrapper = mountResults({
      fit: fitFixture({ residualMs: 4.2 }),
      trustworthy: false,
    });

    expect(wrapper.text()).toContain(`${BASE}.check.scattered.title`);
    expect(applyButton(wrapper)).toBeUndefined();
  });

  it("says the bracket was too quick when the two readings were close", () => {
    const wrapper = mountResults({
      fit: fitFixture({ bracketSpanSeconds: 8, runSpanSeconds: 200 }),
      trustworthy: false,
    });

    expect(wrapper.text()).toContain(`${BASE}.check.short_bracket.title`);
    expect(applyButton(wrapper)).toBeUndefined();
  });

  it("names a speaker it never heard, and refuses to apply without it", () => {
    const wrapper = mountResults({
      fit: fitFixture({ offsetsMs: { living: 0 } }),
      trustworthy: false,
    });

    // Leaving it out of the payload would make the mismatch worse, not better:
    // the server moves the speakers it is given and leaves this one where it was.
    expect(wrapper.text()).toContain(`${BASE}.check.unmeasured.title`);
    expect(wrapper.text()).toContain(`${BASE}.unheard`);
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(applyButton(wrapper)).toBeUndefined();
  });

  it("blames a single spoiled reading even when the run-wide scatter is fine", () => {
    const wrapper = mountResults({
      fit: fitFixture({
        residualMs: 0.03,
        visits: [
          {
            visit: 0,
            playerId: "living",
            samples: 10,
            used: 10,
            meanResidualMs: 0,
            spreadMs: 0.05,
          },
          {
            visit: 1,
            playerId: "kitchen",
            samples: 10,
            used: 10,
            meanResidualMs: 0,
            spreadMs: 6,
          },
        ],
      }),
      trustworthy: false,
    });

    // The run-wide figure is a median, so one bad speaker out of several leaves it
    // untouched; the per-reading spread is what catches it.
    expect(wrapper.text()).toContain(`${BASE}.check.scattered.title`);
  });

  it("reports a real cross-check once there were repeats enough for one", () => {
    const wrapper = mountResults({
      fit: fitFixture({ bracketResidualMs: 0.4 }),
    });

    expect(wrapper.text()).toContain(`${BASE}.check.checked.title`);
  });

  it("refuses a run whose repeated readings disagree", () => {
    const wrapper = mountResults({
      fit: fitFixture({ bracketResidualMs: 3.1 }),
      trustworthy: false,
    });

    expect(wrapper.text()).toContain(`${BASE}.check.disagrees.title`);
    expect(applyButton(wrapper)).toBeUndefined();
  });

  it("refuses a rate no clock could have, and shows nothing to apply", () => {
    const wrapper = mountResults({
      fit: fitFixture({ rateErrorPpm: -3318.7, residualMs: 17.03 }),
      trustworthy: false,
    });

    // Offsets that came out of the wrong chirp are not readings, so they are not
    // shown at all: alongside the reason they cannot be believed they would only
    // invite someone to copy them onto a speaker by hand.
    expect(wrapper.text()).toContain(`${BASE}.check.irreconcilable.title`);
    expect(wrapper.findAll("li")).toHaveLength(0);
    expect(applyButton(wrapper)).toBeUndefined();
    expect(finishButton(wrapper).exists()).toBe(true);
  });

  it("refuses speakers too far apart to place, and shows nothing to apply", () => {
    const wrapper = mountResults({
      fit: fitFixture({ offsetsMs: { living: 0, kitchen: 600 } }),
      trustworthy: false,
    });

    // Offsets this wide are one reading of the recording rather than the reading,
    // so they are withheld for the same reason a misassigned run's are, and the
    // span is named where the advice would otherwise be about the walk.
    expect(wrapper.text()).toContain(`${BASE}.check.unindexable.title`);
    expect(wrapper.text()).toContain("600 500");
    expect(wrapper.findAll("li")).toHaveLength(0);
    expect(applyButton(wrapper)).toBeUndefined();
    expect(finishButton(wrapper).exists()).toBe(true);
  });

  it("gives the scatter one speaker at a time, worst first", () => {
    const wrapper = mountResults({
      fit: fitFixture({ scatterMs: { living: 0.04, kitchen: 17.03 } }),
    });

    // A single bad speaker and detection that was poor everywhere read the same
    // in one run-wide figure, and want entirely different things done about them.
    const scatter = wrapper.findAll("dd")[1].findAll("span");
    expect(scatter).toHaveLength(2);
    expect(scatter[0].text()).toContain("Kitchen");
    expect(scatter[0].text()).toContain("17.03");
    expect(scatter[1].text()).toContain("Living room");
  });

  it("announces its verdict, since it is what the walk was for", () => {
    expect(mountResults().find('[role="status"]').exists()).toBe(true);
  });

  it("hands the offsets over when asked", async () => {
    const wrapper = mountResults();

    await applyButton(wrapper)!.trigger("click");

    expect(wrapper.emitted("apply")).toHaveLength(1);
  });

  it("says whether the run can be applied in a word, ahead of the reasons", () => {
    expect(mountResults().text()).toContain(`${BASE}.ready`);
    expect(mountResults({ trustworthy: false }).text()).toContain(
      `${BASE}.not_ready`,
    );
  });

  it("shows the delay each speaker is about to be given, before it is given", () => {
    const [living, kitchen] = mountResults().findAll("li");

    // Worked out the way the server will: the earliest speaker stays where it
    // is and the later one is brought forward to meet it.
    expect(living.text()).toContain(`${BASE}.planned_delay 0`);
    expect(kitchen.text()).toContain(`${BASE}.planned_delay 12`);
    // The reading that says why sits under it.
    expect(kitchen.text()).toContain(`${BASE}.milliseconds 12.35`);
  });

  it("puts the earliest speaker at zero wherever the walk started", () => {
    const [living, kitchen] = mountResults({
      fit: fitFixture({ offsetsMs: { living: 0, kitchen: -7.25 } }),
    }).findAll("li");

    // Kitchen arrived first, so it is the one left alone.
    expect(living.text()).toContain(`${BASE}.planned_delay 7`);
    expect(kitchen.text()).toContain(`${BASE}.planned_delay 0`);
  });

  it("says a speaker it cannot write to gets an amount to add, before applying", () => {
    const [, kitchen] = mountResults({
      players: [PLAYERS[0], { ...PLAYERS[1], adjustable: false }],
    }).findAll("li");

    expect(kitchen.text()).toContain(`${MANUAL}.row 12`);
    expect(kitchen.text()).not.toContain(`${BASE}.planned_delay`);
  });

  it("promises no delay from a run that cannot be applied", () => {
    const wrapper = mountResults({
      fit: fitFixture({ residualMs: 4.2 }),
      trustworthy: false,
    });

    expect(wrapper.text()).not.toContain(`${BASE}.planned_delay`);
    expect(wrapper.findAll("li")[1].text()).toContain(
      `${BASE}.milliseconds 12.35`,
    );
  });

  it("shows the delay the server actually set, and will not apply twice", () => {
    const wrapper = mountResults({
      applyResult: {
        applied: { living: 12, kitchen: 0 },
        previous: { living: 250, kitchen: 0 },
        manual: {},
      },
    });

    // With what it replaced, which is the number to set by hand to undo it.
    expect(wrapper.findAll("li")[0].text()).toContain(
      `${BASE}.applied_delay 12 250`,
    );
    expect(wrapper.text()).toContain(`${BASE}.undo`);
    expect(wrapper.text()).toContain(`${BASE}.applied_heading.title`);
    expect(wrapper.text()).not.toContain(`${MANUAL}.title`);
    expect(wrapper.text()).not.toContain(`${MANUAL}.badge`);
    // The server folds in the delays the speakers carry, so a second apply of
    // the same readings would correct the correction.
    expect(applyButton(wrapper)).toBeUndefined();
  });

  it("makes giving the speakers back the next step once the delays are in", async () => {
    const wrapper = mountResults({
      applyResult: {
        applied: { living: 12, kitchen: 0 },
        previous: { living: 0, kitchen: 0 },
        manual: {},
      },
    });

    await buttonSaying(wrapper, `${BASE}.done`)!.trigger("click");

    expect(wrapper.emitted("finish")).toHaveLength(1);
  });

  it("offers to check the result once a delay was written", async () => {
    expect(
      buttonSaying(mountResults(), `${BASE}.verify_action`),
    ).toBeUndefined();

    const wrapper = mountResults({
      applyResult: {
        applied: { living: 12, kitchen: 0 },
        previous: { living: 0, kitchen: 0 },
        manual: {},
      },
    });
    await buttonSaying(wrapper, `${BASE}.verify_action`)!.trigger("click");

    expect(wrapper.emitted("verify")).toHaveLength(1);
  });

  it("reads a walk over applied delays as a check, and promises no delay from it", () => {
    const wrapper = mountResults({
      fit: fitFixture({ offsetsMs: { living: 0, kitchen: 0.4 } }),
      verifying: true,
    });

    expect(wrapper.text()).toContain(`${BASE}.verify_heading.title`);
    // The speakers carry delays this page cannot see, so what the server would
    // set from these readings is not something to put a number on here.
    expect(wrapper.text()).not.toContain(`${BASE}.planned_delay`);
    expect(wrapper.findAll("li")[1].text()).toContain(
      `${BASE}.milliseconds 0.40`,
    );
  });

  it("keeps the technical figures out of the way of the decision", () => {
    const details = mountResults().find("details");

    expect(details.attributes("open")).toBeUndefined();
    expect(details.find("summary").text()).toContain(`${BASE}.technical`);
    expect(details.text()).toContain(`${BASE}.ppm 40.0`);
  });

  it("marks a speaker no delay can be written to, before anything is applied", () => {
    const wrapper = mountResults({
      players: [PLAYERS[0], { ...PLAYERS[1], adjustable: false }],
    });

    // The badge carries over from the picker, so the split at Apply is not a
    // surprise. The guidance waits until there are real values to act on.
    expect(wrapper.text()).toContain(`${MANUAL}.badge`);
    expect(wrapper.text()).not.toContain(`${MANUAL}.title`);
  });

  it("hands over the delays nothing could be written to, prominently", () => {
    const wrapper = mountResults({
      players: [PLAYERS[0], { ...PLAYERS[1], adjustable: false }],
      applyResult: {
        applied: { living: 0 },
        previous: { living: 0 },
        manual: { kitchen: 12 },
      },
    });

    const [living, kitchen] = wrapper.findAll("li");
    // An amount to add, worded so it cannot be read as the applied row's
    // "set to" — the two numbers look alike and mean opposite things. Each
    // leads its row, with the reading it came from dimmed underneath.
    expect(kitchen.find(".items-end .font-medium").text()).toBe(
      `${MANUAL}.row 12`,
    );
    expect(kitchen.text()).not.toContain(`${BASE}.applied_delay`);
    expect(living.find(".items-end .font-medium").text()).toBe(
      `${BASE}.applied_delay 0 0`,
    );
    expect(kitchen.find(".items-end .text-muted-foreground").text()).toBe(
      `${BASE}.milliseconds 12.35`,
    );
    expect(wrapper.text()).toContain(`${MANUAL}.title`);
  });

  it("follows the server over the speaker's own flag once it has written", () => {
    const wrapper = mountResults({
      applyResult: {
        applied: { living: 0 },
        previous: { living: 0 },
        manual: { kitchen: 12 },
      },
    });

    // Both speakers reported themselves adjustable, and the server still could
    // not write to one. It decides that at write time, so it wins here.
    expect(wrapper.findAll("li")[1].text()).toContain(`${MANUAL}.badge`);
    expect(wrapper.findAll("li")[0].text()).not.toContain(`${MANUAL}.badge`);
  });

  it("treats an all-manual run as a result, not a failure", () => {
    const wrapper = mountResults({
      players: PLAYERS.map((player) => ({ ...player, adjustable: false })),
      applyResult: {
        applied: {},
        previous: {},
        manual: { living: 0, kitchen: 12 },
      },
    });

    // Every delay was worked out; none of them was written. So there is nothing
    // to undo and nothing a second walk could check, and neither is offered.
    expect(wrapper.text()).not.toContain(`${BASE}.applied_delay`);
    expect(wrapper.text()).not.toContain(`${BASE}.undo`);
    expect(buttonSaying(wrapper, `${BASE}.verify_action`)).toBeUndefined();
    expect(buttonSaying(wrapper, `${BASE}.done`)).toBeDefined();
    expect(wrapper.text()).toContain(`${MANUAL}.title`);
  });

  it("can be finished without applying anything", async () => {
    const wrapper = mountResults({ trustworthy: false });

    await finishButton(wrapper).trigger("click");

    expect(wrapper.emitted("finish")).toHaveLength(1);
  });
});
