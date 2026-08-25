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
  type ConfigEntry,
  type SetupFlowStep,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import SetupFlowDialog from "@/components/SetupFlowDialog.vue";

const { apiMock, eventbusMock, routerMock, storeMock, toastMock } = vi.hoisted(
  () => ({
    apiMock: {
      abortSetupFlow: vi.fn<MusicAssistantApi["abortSetupFlow"]>(),
      players: {},
      providerManifests: {},
      providers: {
        "spotify--test": {
          domain: "spotify",
        },
      },
      reconfigureProvider: vi.fn<MusicAssistantApi["reconfigureProvider"]>(),
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
  | ((event: {
      kind: "reconfigure";
      instanceId: string;
      onFlowEnded: () => void;
    }) => Promise<void>)
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
  $t: (key: string) => key,
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
