import {
  config,
  flushPromises,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigEntryType,
  FlowStepType,
  SILENT_FINISH_STEP_ID,
  type ConfigEntry,
  type SetupFlowStep,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import type { SetupFlowDialogEvent } from "@/plugins/eventbus";
import SetupFlowDialog from "@/components/SetupFlowDialog.vue";

const { apiMock, eventbusMock, routerMock, storeMock, toastMock } = vi.hoisted(
  () => ({
    apiMock: {
      abortSetupFlow: vi.fn<MusicAssistantApi["abortSetupFlow"]>(),
      players: {
        "player-1": { name: "Living Room" },
      },
      providerManifests: {},
      providers: {
        "spotify--test": {
          domain: "spotify",
          name: "Spotify",
        },
      },
      reconfigureProvider: vi.fn<MusicAssistantApi["reconfigureProvider"]>(),
      setupPlayer: vi.fn<MusicAssistantApi["setupPlayer"]>(),
      state: {
        value: "authenticated",
      },
      submitSetupFlow: vi.fn<MusicAssistantApi["submitSetupFlow"]>(),
      subscribeSetupFlow: vi.fn<MusicAssistantApi["subscribeSetupFlow"]>(),
    },
    eventbusMock: {
      off: vi.fn(),
      on: vi.fn(),
    },
    routerMock: {
      push: vi.fn(),
    },
    storeMock: {
      dialogActive: false,
    },
    toastMock: {
      error: vi.fn(),
    },
  }),
);

let launchSetupFlow:
  | ((event: SetupFlowDialogEvent) => Promise<void>)
  | undefined;

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  ConnectionState: {
    AUTHENTICATED: "authenticated",
  },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args?.length ? `${key}:${args.join(",")}` : key,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/views/settings/ConfigEntryRow.vue", () => ({
  default: {
    name: "ConfigEntryRow",
    props: ["confEntry", "disabled"],
    template: "<div />",
  },
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: () => routerMock,
  };
});

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

// shallowMount would stub the step copy away; render it as plain text instead
// so the assertions below keep seeing it
const originalStubs = config.global.stubs;
config.global.stubs = {
  ...originalStubs,
  MarkdownText: {
    props: ["text"],
    template: "<div>{{ text }}</div>",
  },
};

afterAll(() => {
  config.global.stubs = originalStubs;
});

beforeEach(() => {
  vi.clearAllMocks();
  launchSetupFlow = undefined;
  apiMock.subscribeSetupFlow.mockReturnValue(vi.fn());
  eventbusMock.on.mockImplementation(
    (event: string, callback: typeof launchSetupFlow) => {
      if (event === "setupFlowDialog") {
        launchSetupFlow = callback;
      }
    },
  );
});

describe("SetupFlowDialog", () => {
  it.each([FlowStepType.FINISH, FlowStepType.ABORT])(
    "notifies reconfigure callers when the flow ends with %s",
    async (type) => {
      apiMock.reconfigureProvider.mockResolvedValue(terminalStep(type));
      const onFlowEnded = vi.fn();
      shallowMount(SetupFlowDialog);

      await launchSetupFlow?.({
        kind: "reconfigure",
        instanceId: "spotify--test",
        onFlowEnded,
      });
      await flushPromises();

      expect(onFlowEnded).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { type: FlowStepType.FINISH, finished: true },
    { type: FlowStepType.ABORT, finished: false },
  ])(
    "reports finished=$finished when a player flow ends with $type",
    async ({ type, finished }) => {
      apiMock.setupPlayer.mockResolvedValue(terminalStep(type));
      const onFlowEnded = vi.fn();
      shallowMount(SetupFlowDialog);

      await launchSetupFlow?.({
        kind: "player",
        playerId: "player-1",
        onFlowEnded,
      });
      await flushPromises();

      expect(onFlowEnded).toHaveBeenCalledExactlyOnceWith(finished);
    },
  );

  it.each([
    [
      "player",
      { kind: "player", playerId: "player-1" },
      "settings.setup_flow.setup_title:Living Room",
    ],
    [
      "reconfigure",
      { kind: "reconfigure", instanceId: "spotify--test" },
      "settings.setup_flow.reconfigure_title:Spotify",
    ],
  ] as [string, SetupFlowDialogEvent, string][])(
    "heads a %s flow with the name of what it sets up",
    async (_kind, event, expected) => {
      const wrapper = await mountHeader(event);

      expect(headerText(wrapper, "dialog-title-stub")).toBe(expected);
    },
  );

  // the id is all the launch event carries, so an unknown target must still read sanely
  it("heads a player flow with an unnamed title when the player is unknown", async () => {
    const wrapper = await mountHeader({
      kind: "player",
      playerId: "player-gone",
    });

    expect(headerText(wrapper, "dialog-title-stub")).toBe(
      "settings.setup_flow.setup_player_title",
    );
  });

  it("puts the step's own title under the flow title", async () => {
    const wrapper = await mountHeader(
      { kind: "player", playerId: "player-1" },
      { ...formStep(), title: "Enter the pairing code" },
    );

    expect(headerText(wrapper, "dialog-description-stub")).toBe(
      "Enter the pairing code",
    );
  });

  it("leaves the subtitle out when the step brings no title", async () => {
    const wrapper = await mountHeader({ kind: "player", playerId: "player-1" });

    expect(
      wrapper
        .find("dialog-header-stub")
        .find("dialog-description-stub")
        .exists(),
    ).toBe(false);
  });

  it("closes without an abort when a flow finishes silently", async () => {
    apiMock.setupPlayer.mockResolvedValue({
      ...terminalStep(FlowStepType.FINISH),
      step_id: SILENT_FINISH_STEP_ID,
    });
    const onFlowEnded = vi.fn();
    shallowMount(SetupFlowDialog);

    await launchSetupFlow?.({
      kind: "player",
      playerId: "player-1",
      onFlowEnded,
    });
    await flushPromises();

    expect(onFlowEnded).toHaveBeenCalledExactlyOnceWith(true);
    expect(storeMock.dialogActive).toBe(false);
    expect(apiMock.abortSetupFlow).not.toHaveBeenCalled();
  });

  it("keeps the pushed step when a stale submit response lands after it", async () => {
    apiMock.reconfigureProvider.mockResolvedValue(formStep());
    let resolveSubmit: (step: SetupFlowStep) => void = () => {};
    apiMock.submitSetupFlow.mockReturnValue(
      new Promise<SetupFlowStep>((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const wrapper = shallowMount(SetupFlowDialog, {
      global: { renderStubDefaultSlot: true },
    });

    await launchSetupFlow?.({
      kind: "reconfigure",
      instanceId: "spotify--test",
      onFlowEnded: vi.fn(),
    });
    await flushPromises();

    const pushStep = apiMock.subscribeSetupFlow.mock.calls[0][1] as (
      step: SetupFlowStep,
    ) => void;
    await wrapper.find("form").trigger("submit");

    // the server pushes the follow-up step before the submit call comes back
    pushStep(progressStep("pushed"));
    await flushPromises();
    resolveSubmit(progressStep("submitted"));
    await flushPromises();

    expect(wrapper.text()).toContain("pushed");
    expect(wrapper.text()).not.toContain("submitted");
  });

  it("still applies the submit response when the same step is re-served", async () => {
    apiMock.reconfigureProvider.mockResolvedValue(formStep());
    let resolveSubmit: (step: SetupFlowStep) => void = () => {};
    apiMock.submitSetupFlow.mockReturnValue(
      new Promise<SetupFlowStep>((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const wrapper = shallowMount(SetupFlowDialog, {
      global: { renderStubDefaultSlot: true },
    });

    await launchSetupFlow?.({
      kind: "reconfigure",
      instanceId: "spotify--test",
      onFlowEnded: vi.fn(),
    });
    await flushPromises();

    const pushStep = apiMock.subscribeSetupFlow.mock.calls[0][1] as (
      step: SetupFlowStep,
    ) => void;
    await wrapper.find("form").trigger("submit");

    // a reconcile re-serving the current step must not count as moving on
    pushStep(formStep());
    await flushPromises();
    resolveSubmit(progressStep("submitted"));
    await flushPromises();

    expect(wrapper.text()).toContain("submitted");
  });

  it("hides an alert while its dependency is unmet, but keeps the input", async () => {
    apiMock.reconfigureProvider.mockResolvedValue(
      formStep([
        entry({ key: "enable_feature", type: ConfigEntryType.BOOLEAN }),
        entry({
          key: "feature_warning",
          type: ConfigEntryType.ALERT,
          depends_on: "enable_feature",
          depends_on_value: true,
        }),
        entry({
          key: "feature_detail",
          type: ConfigEntryType.STRING,
          depends_on: "enable_feature",
          depends_on_value: true,
        }),
      ]),
    );
    const wrapper = shallowMount(SetupFlowDialog, {
      global: { renderStubDefaultSlot: true },
    });

    await launchSetupFlow?.({
      kind: "reconfigure",
      instanceId: "spotify--test",
      onFlowEnded: vi.fn(),
    });
    await flushPromises();

    const rows = wrapper.findAllComponents({ name: "ConfigEntryRow" });
    expect(
      rows.map((row) => (row.props("confEntry") as ConfigEntry).key),
    ).toEqual(["enable_feature", "feature_detail"]);
    expect(rows[0].props("disabled")).toBe(false);
    expect(rows[1].props("disabled")).toBe(true);
  });

  it("gates an entry whose dependency key is not in the step", async () => {
    apiMock.reconfigureProvider.mockResolvedValue(
      formStep([
        entry({
          key: "feature_warning",
          type: ConfigEntryType.ALERT,
          depends_on: "typo_in_this_key",
        }),
        entry({
          key: "feature_detail",
          type: ConfigEntryType.STRING,
          depends_on: "typo_in_this_key",
        }),
      ]),
    );
    const wrapper = shallowMount(SetupFlowDialog, {
      global: { renderStubDefaultSlot: true },
    });

    await launchSetupFlow?.({
      kind: "reconfigure",
      instanceId: "spotify--test",
      onFlowEnded: vi.fn(),
    });
    await flushPromises();

    const rows = wrapper.findAllComponents({ name: "ConfigEntryRow" });
    expect(
      rows.map((row) => (row.props("confEntry") as ConfigEntry).key),
    ).toEqual(["feature_detail"]);
    expect(rows[0].props("disabled")).toBe(true);
  });

  it("offers the next step despite a required entry behind an unmet dependency", async () => {
    const wrapper = await mountFormStep([
      entry({ key: "use_proxy", type: ConfigEntryType.BOOLEAN, value: false }),
      entry({
        key: "proxy_url",
        type: ConfigEntryType.STRING,
        required: true,
        depends_on: "use_proxy",
      }),
    ]);

    expect(submitDisabled(wrapper)).toBe(false);
  });

  it("withholds the next step once that dependency is met", async () => {
    const wrapper = await mountFormStep([
      entry({ key: "use_proxy", type: ConfigEntryType.BOOLEAN, value: true }),
      entry({
        key: "proxy_url",
        type: ConfigEntryType.STRING,
        required: true,
        depends_on: "use_proxy",
      }),
    ]);

    expect(submitDisabled(wrapper)).toBe(true);
  });

  it("submits a lone choice step as soon as an option is picked", async () => {
    apiMock.submitSetupFlow.mockResolvedValue(progressStep("submitted"));
    const wrapper = await mountFormStep([choiceEntry()]);

    await pickOption(wrapper, "b");

    expect(apiMock.submitSetupFlow).toHaveBeenCalledWith("flow-1", {
      method: "b",
    });
  });

  it("still auto-advances past a label sitting beside the choice", async () => {
    apiMock.submitSetupFlow.mockResolvedValue(progressStep("submitted"));
    const wrapper = await mountFormStep([
      entry({ key: "intro", type: ConfigEntryType.LABEL }),
      choiceEntry(),
    ]);

    await pickOption(wrapper, "b");

    expect(apiMock.submitSetupFlow).toHaveBeenCalledOnce();
  });

  it("drops the confirm button from a step that submits on pick", async () => {
    const wrapper = await mountFormStep([choiceEntry()]);

    expect(stepFooterLabels(wrapper)).toEqual(["cancel"]);
  });

  it("shows progress while a step that submits on pick is in flight", async () => {
    apiMock.submitSetupFlow.mockReturnValue(
      new Promise<SetupFlowStep>(() => {}),
    );
    const wrapper = await mountFormStep([choiceEntry()]);

    await pickOption(wrapper, "b");

    expect(
      wrapper.find("dialog-footer-stub").findAll("spinner-stub"),
    ).toHaveLength(1);
  });

  it("leaves an optional choice to the confirm button", async () => {
    const wrapper = await mountFormStep([
      { ...choiceEntry(), required: false },
    ]);

    await pickOption(wrapper, "b");

    expect(apiMock.submitSetupFlow).not.toHaveBeenCalled();
    expect(stepFooterLabels(wrapper)).toEqual([
      "cancel",
      "settings.setup_flow.next",
    ]);
  });

  it("ignores a hidden field when deciding to submit on pick", async () => {
    apiMock.submitSetupFlow.mockResolvedValue(progressStep("submitted"));
    const wrapper = await mountFormStep([
      entry({ key: "token", type: ConfigEntryType.STRING, hidden: true }),
      choiceEntry(),
    ]);

    await pickOption(wrapper, "b");

    expect(apiMock.submitSetupFlow).toHaveBeenCalledOnce();
  });

  it("waits for the button when a second field shares the form", async () => {
    const wrapper = await mountFormStep([
      choiceEntry(),
      entry({ key: "note", type: ConfigEntryType.STRING }),
    ]);

    await pickOption(wrapper, "b");

    expect(apiMock.submitSetupFlow).not.toHaveBeenCalled();
  });
});

async function pickOption(wrapper: VueWrapper, value: string) {
  const row = wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    .find(
      (candidate) =>
        (candidate.props("confEntry") as ConfigEntry).key === "method",
    );
  if (!row) throw new Error("choice entry not rendered");
  row.vm.$emit("update:value", value);
  await flushPromises();
}

async function mountHeader(
  event: SetupFlowDialogEvent,
  step: SetupFlowStep = formStep(),
) {
  apiMock.setupPlayer.mockResolvedValue(step);
  apiMock.reconfigureProvider.mockResolvedValue(step);
  const wrapper = shallowMount(SetupFlowDialog, {
    global: { renderStubDefaultSlot: true },
  });

  await launchSetupFlow?.(event);
  await flushPromises();

  return wrapper;
}

// the per-field help dialog carries a title of its own, so scope to the step's header
function headerText(wrapper: VueWrapper, stub: string) {
  return wrapper.find("dialog-header-stub").find(stub).text();
}

async function mountFormStep(entries: ConfigEntry[]) {
  apiMock.reconfigureProvider.mockResolvedValue(formStep(entries));
  const wrapper = shallowMount(SetupFlowDialog, {
    global: { renderStubDefaultSlot: true },
  });

  await launchSetupFlow?.({
    kind: "reconfigure",
    instanceId: "spotify--test",
    onFlowEnded: vi.fn(),
  });
  await flushPromises();

  return wrapper;
}

// the per-field help dialog carries a footer of its own, so scope to the step's
function stepFooterLabels(wrapper: VueWrapper) {
  return wrapper
    .find("dialog-footer-stub")
    .findAll("button-stub")
    .map((btn) => btn.text());
}

function submitDisabled(wrapper: VueWrapper) {
  const button = wrapper
    .findAll("button-stub")
    .find((btn) => btn.text() === "settings.setup_flow.next");
  if (!button) throw new Error("submit button not rendered");
  return button.attributes("disabled") === "true";
}

function terminalStep(type: FlowStepType): SetupFlowStep {
  return {
    entries: [],
    errors: {},
    flow_id: "flow-1",
    step_id: type,
    type,
  };
}

function formStep(entries: ConfigEntry[] = []): SetupFlowStep {
  return {
    entries,
    errors: {},
    flow_id: "flow-1",
    step_id: "form",
    type: FlowStepType.FORM,
  };
}

function choiceEntry(): ConfigEntry {
  return entry({
    key: "method",
    type: ConfigEntryType.STRING,
    required: true,
    expanded_options: true,
    options: [
      { title: "Code", value: "a" },
      { title: "Manual", value: "b" },
    ],
  });
}

function entry(
  overrides: Partial<ConfigEntry> & { key: string; type: ConfigEntryType },
): ConfigEntry {
  return {
    category: "generic",
    default_value: null,
    label: overrides.key,
    required: false,
    options: [],
    value: null,
    ...overrides,
  };
}

function progressStep(progressText: string): SetupFlowStep {
  return {
    entries: [],
    errors: {},
    flow_id: "flow-1",
    progress_text: progressText,
    step_id: progressText,
    type: FlowStepType.PROGRESS,
  };
}
