import SendspinSyncResults from "@/components/sendspin-sync/SendspinSyncResults.vue";
import SendspinSyncWalk from "@/components/sendspin-sync/SendspinSyncWalk.vue";
import { CHIRP_PERIOD_SECONDS } from "@/helpers/sendspin-sync/chirp";
import type { CalibrationApplyResult } from "@/plugins/api/interfaces";
import SendspinSyncView from "@/views/SendspinSyncView.vue";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { routeLeaveGuards, run, toastSuccess } = vi.hoisted(() => ({
  routeLeaveGuards: [] as (() => unknown)[],
  toastSuccess: vi.fn(),
  run: {
    loadPlayers: vi.fn(),
    refresh: vi.fn(),
    begin: vi.fn(),
    measure: vi.fn(),
    clearReadings: vi.fn(),
    apply: vi.fn(),
    verify: vi.fn(),
    finish: vi.fn(),
    endAdopted: vi.fn(),
    restart: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  onBeforeRouteLeave: (guard: () => unknown) => routeLeaveGuards.push(guard),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: toastSuccess, error: vi.fn() },
}));

vi.mock("@/composables/sendspin-sync/useCalibrationRun", () => ({
  BRACKET_LIMIT_MS: 1,
  SCATTER_LIMIT_MS: 1,
  useCalibrationRun: () => state,
}));

// The probe owns a microphone and thirty seconds of capture; none of that is what
// these tests are about.
vi.mock("@/components/sendspin-sync/SendspinSyncProbe.vue", () => ({
  default: { name: "SendspinSyncProbe", template: "<div />" },
}));

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
    busy: true,
    adjustable: true,
    silent: false,
  },
];

/** A fit good enough for the results panel to have something to show. */
const FIT = {
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
};

let state: ReturnType<typeof makeState>;

function makeState() {
  return {
    players: ref(PLAYERS),
    sessionState: ref<unknown>(null),
    sessionLost: ref<string | null>(null),
    sessionProblem: ref<
      { kind: "refused"; message: string } | { kind: "unreachable" } | null
    >(null),
    busy: ref(false),
    phase: ref("picking"),
    selected: ref<string[]>([]),
    visits: ref<unknown[]>([]),
    measuringPlayerId: ref<string | null>(null),
    secondsLeft: ref(0),
    starting: ref(false),
    verifying: ref(false),
    anchor: ref<string | null>(null),
    remaining: ref<string[]>([]),
    needsBracket: ref(false),
    needsCheck: ref(false),
    fit: ref<unknown>(null),
    loss: ref({ dropouts: 0, worstFraction: 0 }),
    spacingSeconds: ref<number | null>(CHIRP_PERIOD_SECONDS),
    verdict: ref<string | null>(null),
    trustworthy: ref(false),
    crossChecked: ref(false),
    applyResult: ref<CalibrationApplyResult | null>(null),
    openError: ref<string | null>(null),
    ...run,
  };
}

let wrappers: ReturnType<typeof mount>[] = [];

/**
 * Mount the view, and remember it so the test tears it down.
 *
 * The view listens for `pagehide` on the window, so a wrapper left mounted would
 * still be handing speakers back during the next test.
 *
 * `$t` is mocked for the child components, which take it from the global. The view
 * itself imports `$t` directly, so its own strings resolve against the real
 * `en.json` — which is why the assertions below read as English and why a renamed
 * key fails here rather than turning into a blank on a phone.
 */
function mountView() {
  const wrapper = mount(SendspinSyncView, {
    global: { mocks: { $t: (key: string) => key } },
  });
  wrappers.push(wrapper);
  return wrapper;
}

/**
 * Say what this browser can do about a microphone.
 *
 * The view reads both once, as it is set up, so this has to come before the
 * mount. jsdom offers neither, which is the blocked case and not the usual one.
 */
function browserWith(options: { secure: boolean; microphone: boolean }): void {
  Object.defineProperty(window, "isSecureContext", {
    value: options.secure,
    configurable: true,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    value: options.microphone ? { getUserMedia: vi.fn() } : undefined,
    configurable: true,
  });
}

beforeEach(() => {
  wrappers = [];
  routeLeaveGuards.length = 0;
  state = makeState();
  browserWith({ secure: true, microphone: true });
  toastSuccess.mockReset();
  for (const fake of Object.values(run)) fake.mockReset();
  run.begin.mockResolvedValue(true);
  run.apply.mockResolvedValue(true);
  for (const name of [
    "loadPlayers",
    "refresh",
    "finish",
    "restart",
    "endAdopted",
  ] as const)
    run[name].mockResolvedValue(undefined);
});

afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  vi.restoreAllMocks();
});

/** Let the awaits of a handler that was just triggered run out. */
async function settled(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

describe("SendspinSyncView", () => {
  it("looks for an existing session and the eligible speakers on arrival", async () => {
    mountView();
    await Promise.resolve();

    expect(run.refresh).toHaveBeenCalledOnce();
    expect(run.loadPlayers).toHaveBeenCalledOnce();
  });

  it("offers the speaker picker before anything has started", () => {
    const wrapper = mountView();

    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.calibration.pick.title",
    );
    expect(wrapper.text()).not.toContain(
      "providers.sendspin_sync.calibration.walk.step.start.title",
    );
  });

  it("hands the speakers back when the route is left", async () => {
    mountView();
    expect(routeLeaveGuards).toHaveLength(1);

    await routeLeaveGuards[0]();

    // The session's own inactivity timeout is a backstop against a phone that
    // vanished, not this flow's cleanup path: leaving must give the speakers back
    // rather than leave them muted for fifteen minutes.
    expect(run.restart).toHaveBeenCalledOnce();
  });

  it("hands the speakers back when the page goes away", () => {
    mountView();

    window.dispatchEvent(new Event("pagehide"));

    expect(run.restart).toHaveBeenCalledOnce();
  });

  it("stops listening for the page going away once it is unmounted", () => {
    const wrapper = mountView();
    wrapper.unmount();
    run.restart.mockClear();

    window.dispatchEvent(new Event("pagehide"));

    expect(run.restart).not.toHaveBeenCalled();
  });

  it("shows the walk once a run has started", async () => {
    state.phase.value = "walking";
    state.selected.value = ["living", "kitchen"];
    state.anchor.value = "living";
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.calibration.walk.step.start.title",
    );
    expect(wrapper.text()).toContain("Living room");
  });

  it("replaces the flow with the reason a run was voided", async () => {
    state.phase.value = "voided";
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("This run has to be thrown away");
    expect(wrapper.text()).not.toContain(
      "providers.sendspin_sync.calibration.pick.title",
    );
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
  });

  it("names an expired session rather than blaming the microphone", async () => {
    state.phase.value = "voided";
    state.sessionLost.value = "expired";
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("This calibration has ended");
    // Whatever was applied before it ended is still on the speakers, so the card
    // does not claim nothing was changed.
    expect(wrapper.text()).toContain("already applied are kept");
  });

  it("says a thrown-away run has already given the speakers back", async () => {
    state.phase.value = "voided";
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Your speakers have been given back");
  });

  it("says a page served without a secure connection cannot hear anything", () => {
    browserWith({ secure: false, microphone: false });
    const wrapper = mountView();

    // Known before anything is tapped, so it is said before anything is tapped.
    expect(wrapper.text()).toContain(
      "Open Music Assistant over a secure connection",
    );
    const start = wrapper
      .findAll("button")
      .find((button) =>
        button
          .text()
          .includes("providers.sendspin_sync.calibration.pick.start"),
      )!;
    expect(start.attributes("disabled")).toBeDefined();
  });

  it("says so when the browser has no microphone API at all", () => {
    browserWith({ secure: true, microphone: false });

    expect(mountView().text()).toContain("This browser has no microphone API");
  });

  it("says nothing about the microphone on a browser that can open one", () => {
    const text = mountView().text();

    expect(text).not.toContain("secure connection");
    expect(text).not.toContain("could not be opened");
  });

  it.each([
    ["NotAllowedError", "This page is not allowed to use the microphone"],
    ["NotFoundError", "No microphone could be opened"],
    ["SampleRateError", "The microphone could not be opened"],
  ])("names why the microphone would not open: %s", async (name, title) => {
    state.openError.value = name;
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    // A refusal and a missing device want completely different things done.
    expect(wrapper.text()).toContain(title);
  });

  it("shows the server's own reason for refusing something", async () => {
    state.sessionProblem.value = {
      kind: "refused",
      message: "Kitchen is muted or turned all the way down.",
    };
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    // The picker is still there: a muted speaker is put right in a moment, and
    // is no reason to throw anything away.
    expect(wrapper.text()).toContain("Music Assistant could not do that");
    expect(wrapper.text()).toContain(
      "Kitchen is muted or turned all the way down.",
    );
    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.calibration.pick.title",
    );
  });

  it("says a command did not get through without ending the walk", async () => {
    state.phase.value = "walking";
    state.selected.value = ["living", "kitchen"];
    state.sessionProblem.value = { kind: "unreachable" };
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Music Assistant could not be reached");
    expect(wrapper.text()).toContain("your readings are kept");
    expect(wrapper.findComponent(SendspinSyncWalk).exists()).toBe(true);
  });

  it("says another calibration is running instead of cutting it off", async () => {
    state.sessionState.value = { anchor_player_id: "living" };
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("A calibration is already running");
    // The server holds one session at a time, so starting would be refused.
    expect(wrapper.text()).toContain("End the running calibration");
  });

  it("takes two taps to end a run somebody else may be walking", async () => {
    state.sessionState.value = { anchor_player_id: "living" };
    const wrapper = mountView();
    await wrapper.vm.$nextTick();
    const end = () =>
      wrapper
        .findAll("button")
        .find((button) => button.text().includes("Tap again to end it"))!;

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "End the running calibration")!
      .trigger("click");
    expect(run.endAdopted).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Tap again to end it");

    await end().trigger("click");
    await settled();

    expect(run.endAdopted).toHaveBeenCalledOnce();
    // And looks again at what the server holds, so the picker opens up.
    expect(run.refresh).toHaveBeenCalledTimes(2);
  });

  it("keeps the diagnostics reachable without putting them in the way", () => {
    const wrapper = mountView();

    expect(wrapper.text()).toContain("Microphone diagnostics");
  });

  it("puts the diagnostics away for the length of a walk", async () => {
    state.phase.value = "walking";
    state.selected.value = ["living", "kitchen"];
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    // They open a microphone of their own, and a second one can take the first
    // away mid-reading.
    expect(wrapper.text()).not.toContain("Microphone diagnostics");
  });

  it("holds the results back until the walk has nothing left to ask for", async () => {
    state.phase.value = "walking";
    state.selected.value = ["living", "kitchen"];
    state.anchor.value = "living";
    state.verdict.value = "unbracketed";
    state.fit.value = FIT;
    state.needsBracket.value = true;
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    // Every speaker has a reading, and the walk is on its way back to the first.
    // A panel saying "not checked yet" in red would be about a walk that is
    // going exactly as it should.
    expect(wrapper.findComponent(SendspinSyncResults).exists()).toBe(false);

    state.needsBracket.value = false;
    state.verdict.value = "pinned";
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent(SendspinSyncResults).exists()).toBe(true);
  });

  it("passes a retake through as a retake", async () => {
    state.phase.value = "walking";
    state.selected.value = ["living", "kitchen"];
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    wrapper
      .findComponent(SendspinSyncWalk)
      .vm.$emit("measure", "kitchen", true);

    expect(run.measure).toHaveBeenCalledWith("kitchen", true);
  });

  it("gives the speakers back when the walk is stopped, and says so", async () => {
    state.phase.value = "walking";
    state.selected.value = ["living", "kitchen"];
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    wrapper.findComponent(SendspinSyncWalk).vm.$emit("stop");
    await settled();

    expect(run.restart).toHaveBeenCalledOnce();
    expect(toastSuccess).toHaveBeenCalledWith(
      "Your speakers have been given back.",
    );
  });

  it("starts the walk over without ending the session", async () => {
    state.phase.value = "walking";
    state.selected.value = ["living", "kitchen"];
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    wrapper.findComponent(SendspinSyncWalk).vm.$emit("clear");

    expect(run.clearReadings).toHaveBeenCalledOnce();
    expect(run.restart).not.toHaveBeenCalled();
  });

  it("closes the walk once the delays are applied, until the result is checked", async () => {
    const wrapper = await applyFrom({
      applied: { living: 0 },
      previous: { living: 0 },
      manual: { kitchen: 12 },
    });

    expect(wrapper.findComponent(SendspinSyncWalk).props("closed")).toBe(true);

    wrapper.findComponent(SendspinSyncResults).vm.$emit("verify");
    expect(run.verify).toHaveBeenCalledOnce();
  });

  it("says the delays were updated when the server wrote some", async () => {
    await applyFrom({
      applied: { living: 0 },
      previous: { living: 0 },
      manual: { kitchen: 12 },
    });

    expect(toastSuccess).toHaveBeenCalledWith("Speaker delays updated.");
  });

  it("does not claim an update when nothing could be written", async () => {
    // Every speaker was measured and normalised; none of them took the delay. A
    // toast saying otherwise is the one place all the care below leaks out.
    await applyFrom({
      applied: {},
      previous: {},
      manual: { living: 0, kitchen: 12 },
    });

    expect(toastSuccess).toHaveBeenCalledWith(
      "Delays worked out. Add each one to the speaker's current delay.",
    );
  });
});

/** Walk the view as far as the results panel and press Apply. */
async function applyFrom(result: CalibrationApplyResult) {
  state.phase.value = "walking";
  state.selected.value = ["living", "kitchen"];
  state.anchor.value = "living";
  state.trustworthy.value = true;
  state.verdict.value = "pinned";
  state.fit.value = FIT;
  run.apply.mockImplementation(async () => {
    state.applyResult.value = result;
    return true;
  });

  const wrapper = mountView();
  await wrapper.vm.$nextTick();
  await wrapper
    .findComponent(SendspinSyncResults)
    .find("button")
    .trigger("click");
  await wrapper.vm.$nextTick();
  return wrapper;
}
