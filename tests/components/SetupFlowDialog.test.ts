import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlowStepType, type SetupFlowStep } from "@/plugins/api/interfaces";
import SetupFlowDialog from "@/components/SetupFlowDialog.vue";

const { apiMock, eventbusMock, routerMock, storeMock, toastMock } = vi.hoisted(
  () => ({
    apiMock: {
      abortSetupFlow: vi.fn(),
      players: {},
      providerManifests: {},
      providers: {
        "spotify--test": {
          domain: "spotify",
        },
      },
      reconfigureProvider: vi.fn(),
      state: {
        value: "authenticated",
      },
      submitSetupFlow: vi.fn(),
      subscribeSetupFlow: vi.fn(),
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
});

function terminalStep(type: FlowStepType): SetupFlowStep {
  return {
    entries: [],
    errors: {},
    flow_id: "flow-1",
    step_id: type,
    type,
  };
}

function formStep(): SetupFlowStep {
  return {
    entries: [],
    errors: {},
    flow_id: "flow-1",
    step_id: "form",
    type: FlowStepType.FORM,
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
