import SendspinSyncWalk from "@/components/sendspin-sync/SendspinSyncWalk.vue";
import type { Measurement } from "@/composables/sendspin-sync/useCalibrationRun";
import { CHIRP_PERIOD_SECONDS } from "@/helpers/sendspin-sync/chirp";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

const KEYS = "providers.sendspin_sync.calibration";

const PLAYERS = ["living", "kitchen", "study"].map((player_id, index) => ({
  player_id,
  name: ["Living room", "Kitchen", "Study"][index],
  busy: false,
  adjustable: true,
  silent: false,
}));

const SELECTED = ["living", "kitchen", "study"];

function reading(overrides: Partial<Measurement> = {}): Measurement {
  return {
    visit: 0,
    playerId: "living",
    found: 7,
    expected: 7,
    medianSnr: 40,
    dropouts: 0,
    lostFraction: 0,
    spacingSeconds: CHIRP_PERIOD_SECONDS,
    ...overrides,
  };
}

function mountWalk(
  props: Partial<InstanceType<typeof SendspinSyncWalk>["$props"]> = {},
) {
  return mount(SendspinSyncWalk, {
    props: {
      players: PLAYERS,
      selected: SELECTED,
      visits: [],
      anchor: null,
      needsBracket: false,
      needsCheck: false,
      disabled: false,
      measuring: null,
      ...props,
    },
    // Interpolations are appended so a test can assert which speaker a step names.
    global: {
      mocks: {
        $t: (key: string, values: unknown[] = []) =>
          values.length ? `${key} ${values.join(" ")}` : key,
      },
    },
  });
}

type Walk = ReturnType<typeof mountWalk>;

/** The buttons styled as the action being asked for, by speaker name. */
function askedFor(wrapper: Walk): string[] {
  return wrapper
    .findAll("button")
    .filter((button) => button.classes().includes("bg-primary"))
    .map((button) => button.text());
}

/** One button per speaker, which is not every button on the card. */
function speakerButtons(wrapper: Walk) {
  return wrapper.findAll(".grid > button");
}

function buttonFor(wrapper: Walk, name: string) {
  const button = speakerButtons(wrapper).find((candidate) =>
    candidate.text().includes(name),
  );
  if (!button) throw new Error(`no button for ${name}`);
  return button;
}

/** A button by the string it shows, for the ones that are not a speaker. */
function buttonSaying(wrapper: Walk, key: string) {
  return wrapper
    .findAll("button")
    .find((candidate) => candidate.text().includes(key));
}

describe("SendspinSyncWalk", () => {
  it("asks only where to start before anything is measured", () => {
    const wrapper = mountWalk();

    expect(wrapper.find("[data-slot=card-header]").text()).toContain(
      `${KEYS}.walk.step.start.title`,
    );
    // No speaker is the right one to begin at, so none is singled out.
    expect(askedFor(wrapper)).toHaveLength(3);
  });

  it("offers every speaker at every step, in the order they were picked", () => {
    const buttons = speakerButtons(
      mountWalk({
        visits: [reading()],
        anchor: "living",
      }),
    );

    expect(buttons.map((button) => button.text().split("\n")[0])).toHaveLength(
      3,
    );
    expect(buttons[0].text()).toContain("Living room");
    expect(buttons[1].text()).toContain("Kitchen");
    expect(buttons[2].text()).toContain("Study");
  });

  it("asks for a measurement when a speaker is pressed", async () => {
    const wrapper = mountWalk();

    await buttonFor(wrapper, "Kitchen").trigger("click");

    // Added to whatever was read before, not put in its place: a plain tap on a
    // measured speaker is how the closing steps of the walk get their repeat.
    expect(wrapper.emitted("measure")).toEqual([["kitchen", false]]);
  });

  it("keeps asking for unmeasured speakers without naming one", () => {
    const wrapper = mountWalk({
      visits: [reading({ playerId: "kitchen" })],
      anchor: "kitchen",
    });

    const header = wrapper.find("[data-slot=card-header]").text();
    expect(header).toContain(`${KEYS}.walk.step.next.title`);
    // How far along the walk is, rather than which speaker comes next.
    expect(header).toContain(`${KEYS}.walk.step.next.description 1 3`);
    expect(askedFor(wrapper)).toHaveLength(2);
    expect(askedFor(wrapper).join(" ")).not.toContain("Kitchen");
  });

  /**
   * The case the old highlight got wrong: the walk follows where the user
   * actually went, not the order the speakers were ticked in.
   */
  it("follows an out-of-order walk", async () => {
    const wrapper = mountWalk({
      visits: [
        reading({ playerId: "study" }),
        reading({ visit: 1, playerId: "kitchen" }),
      ],
      anchor: "study",
    });

    expect(askedFor(wrapper)).toEqual([expect.stringContaining("Living room")]);

    await buttonFor(wrapper, "Living room").trigger("click");
    expect(wrapper.emitted("measure")).toEqual([["living", false]]);

    // And the repeat is asked of the speaker actually measured first.
    await wrapper.setProps({
      visits: [
        reading({ playerId: "study" }),
        reading({ visit: 1, playerId: "kitchen" }),
        reading({ visit: 2, playerId: "living" }),
      ],
      needsBracket: true,
    });

    const header = wrapper.find("[data-slot=card-header]").text();
    expect(header).toContain(`${KEYS}.walk.step.repeat.title Study`);
    expect(askedFor(wrapper)).toEqual([expect.stringContaining("Study")]);
  });

  it("names a second speaker to repeat once one more would check the run", () => {
    const wrapper = mountWalk({
      visits: [
        reading(),
        reading({ visit: 1, playerId: "kitchen" }),
        reading({ visit: 2, playerId: "study" }),
        reading({ visit: 3, playerId: "living" }),
      ],
      anchor: "living",
      needsCheck: true,
    });

    // The earliest speaker still read once, so the repeat spans as much of the
    // walk as is left to span.
    const header = wrapper.find("[data-slot=card-header]").text();
    expect(header).toContain(`${KEYS}.walk.step.check.title Kitchen`);
    expect(askedFor(wrapper)).toEqual([expect.stringContaining("Kitchen")]);
  });

  it("stops asking for anything once the run needs nothing more", () => {
    const wrapper = mountWalk({
      visits: [
        reading(),
        reading({ visit: 1, playerId: "kitchen" }),
        reading({ visit: 2, playerId: "study" }),
        reading({ visit: 3, playerId: "living" }),
        reading({ visit: 4, playerId: "kitchen" }),
      ],
      anchor: "living",
    });

    expect(wrapper.find("[data-slot=card-header]").text()).toContain(
      `${KEYS}.walk.step.done.title`,
    );
    expect(askedFor(wrapper)).toHaveLength(0);
    // Still pressable, because re-measuring is always allowed.
    for (const button of wrapper.findAll("button"))
      expect(button.attributes("disabled")).toBeUndefined();
  });

  it("shows measured speakers as measured, and how good the reading was", () => {
    const wrapper = mountWalk({
      visits: [
        reading({ found: 7, expected: 7, medianSnr: 40 }),
        reading({ visit: 1, playerId: "kitchen", found: 3, expected: 7 }),
      ],
      anchor: "living",
    });

    expect(buttonFor(wrapper, "Living room").text()).toContain(
      `${KEYS}.confidence.good`,
    );
    expect(buttonFor(wrapper, "Kitchen").text()).toContain(
      `${KEYS}.confidence.weak`,
    );
    expect(buttonFor(wrapper, "Kitchen").text()).toContain(
      `${KEYS}.walk.found 3 7`,
    );
    expect(buttonFor(wrapper, "Study").text()).toContain(
      `${KEYS}.walk.not_measured`,
    );
  });

  it("shows the most recent reading of a speaker measured twice", () => {
    const wrapper = mountWalk({
      visits: [
        reading({ found: 7, medianSnr: 40 }),
        reading({ visit: 2, found: 1, expected: 7, medianSnr: 40 }),
      ],
      anchor: "living",
    });

    expect(buttonFor(wrapper, "Living room").text()).toContain(
      `${KEYS}.confidence.poor`,
    );
  });

  it("announces the step, so the ask is what a screen reader hears", () => {
    expect(mountWalk().find('[role="status"]').exists()).toBe(true);
  });

  it("locks the buttons while a recording is running", () => {
    const wrapper = mountWalk({ disabled: true, measuring: "living" });

    for (const button of wrapper.findAll("button"))
      expect(button.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain(`${KEYS}.walk.listening`);
  });

  it("says how to hold the phone while nothing is recording", () => {
    expect(mountWalk().text()).toContain(`${KEYS}.walk.how`);
  });

  it("counts the reading down for someone standing still", () => {
    const wrapper = mountWalk({
      disabled: true,
      measuring: "living",
      secondsLeft: 6,
    });

    expect(wrapper.text()).toContain(`${KEYS}.walk.listening_left 6`);
  });

  it("says a measured speaker can be measured again", () => {
    const wrapper = mountWalk({ visits: [reading()], anchor: "living" });

    // A tick alone reads as finished, and the closing steps ask for a repeat.
    expect(buttonFor(wrapper, "Living room").text()).toContain(
      `${KEYS}.walk.again_hint`,
    );
    expect(buttonFor(wrapper, "Kitchen").text()).not.toContain(
      `${KEYS}.walk.again_hint`,
    );
  });

  it("can always be stopped, from the first step on", async () => {
    const wrapper = mountWalk();

    // The house is silent for as long as this card is up, and leaving the page
    // must not be the only way to end that.
    await buttonSaying(wrapper, `${KEYS}.walk.stop`)!.trigger("click");

    expect(wrapper.emitted("stop")).toHaveLength(1);
  });

  it("offers to start the walk over once there is something to throw away", async () => {
    expect(buttonSaying(mountWalk(), `${KEYS}.walk.clear`)).toBeUndefined();

    const wrapper = mountWalk({ visits: [reading()], anchor: "living" });
    await buttonSaying(wrapper, `${KEYS}.walk.clear`)!.trigger("click");

    expect(wrapper.emitted("clear")).toHaveLength(1);
  });

  it("says what to do about a reading that came out badly", async () => {
    const wrapper = mountWalk({
      visits: [
        reading(),
        reading({ visit: 1, playerId: "kitchen", found: 1, expected: 7 }),
      ],
      anchor: "living",
    });

    expect(wrapper.text()).toContain(`${KEYS}.walk.retry.poor Kitchen`);
    expect(wrapper.text()).toContain(`${KEYS}.walk.retry.advice`);

    // Taking it again replaces it: a poor reading left in would go on pulling
    // at the result.
    await buttonSaying(wrapper, `${KEYS}.walk.retry.action`)!.trigger("click");
    expect(wrapper.emitted("measure")).toEqual([["kitchen", true]]);
  });

  it("only offers a retake of the speaker the user is standing at", () => {
    const wrapper = mountWalk({
      visits: [
        reading({ playerId: "kitchen", found: 1, expected: 7 }),
        reading({ visit: 1 }),
      ],
      anchor: "living",
    });

    // The poor one is a room away by now. Its badge still says so.
    expect(wrapper.text()).not.toContain(`${KEYS}.walk.retry.advice`);
    expect(buttonFor(wrapper, "Kitchen").text()).toContain(
      `${KEYS}.confidence.poor`,
    );
  });

  it("takes no more readings once the delays are applied", () => {
    const wrapper = mountWalk({
      visits: [
        reading(),
        reading({ visit: 1, playerId: "kitchen", found: 3, expected: 7 }),
      ],
      anchor: "living",
      closed: true,
    });

    // A reading taken now is of corrected speakers, and would not belong with
    // the ones the correction came from.
    for (const button of speakerButtons(wrapper))
      expect(button.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain(`${KEYS}.walk.closed`);
    expect(wrapper.text()).not.toContain(`${KEYS}.walk.retry.advice`);
    expect(buttonSaying(wrapper, `${KEYS}.walk.clear`)).toBeUndefined();
    // Giving the speakers back is still within reach.
    expect(
      buttonSaying(wrapper, `${KEYS}.walk.stop`)!.attributes("disabled"),
    ).toBeUndefined();
  });

  it("takes the focus the picker left behind", () => {
    const wrapper = mount(SendspinSyncWalk, {
      props: {
        players: PLAYERS,
        selected: SELECTED,
        visits: [],
        anchor: null,
        needsBracket: false,
        needsCheck: false,
        disabled: false,
        measuring: null,
      },
      attachTo: document.body,
      global: { mocks: { $t: (key: string) => key } },
    });

    expect(document.activeElement).toBe(
      wrapper.find("[data-slot=card-header]").element,
    );
    wrapper.unmount();
  });
});
