import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import type { StepPrimaryAction } from "@/helpers/onboarding";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type RemoteAccessInfo,
  Scope,
  type ServerInfoMessage,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ref } from "vue";

const { apiMock, authMock, copyMock, onboardingState, toastMock } = vi.hoisted(
  () => ({
    apiMock: {
      configureRemoteAccess:
        vi.fn<MusicAssistantApi["configureRemoteAccess"]>(),
      getRemoteAccessInfo: vi.fn<MusicAssistantApi["getRemoteAccessInfo"]>(),
      // replaced with a real ref by the api mock factory below
      serverInfo: { value: undefined } as Ref<ServerInfoMessage | undefined>,
    },
    authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
    copyMock: vi.fn<(text: string) => Promise<boolean>>(),
    // the part of the onboarding context this step reads
    onboardingState: {
      homeAssistantAddon: false,
      homeAssistantConfigured: false,
      homeAssistantConnected: false,
    },
    toastMock: { error: vi.fn(), success: vi.fn() },
  }),
);

vi.mock("@/plugins/api", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.serverInfo = ref<ServerInfoMessage | undefined>(undefined);
  return { api: apiMock, default: apiMock };
});

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/composables/useOnboarding", async () => {
  const { computed } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useOnboarding: () => ({ ctx: computed(() => ({ ...onboardingState })) }),
  };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

vi.mock("@/helpers/utils", () => ({ copyToClipboard: copyMock }));

enableAutoUnmount(afterEach);

let warnSpy: ReturnType<typeof vi.spyOn>;

// a remote access id as the server hands it over, and as it is read out
const REMOTE_ID = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const REMOTE_ID_GROUPED = "ABCDEFGH-IJKLM-NOPQR-STUVWXYZ";

function serverInfo(has_remote_access = false): ServerInfoMessage {
  return { server_id: "server-1", has_remote_access } as ServerInfoMessage;
}

function remoteAccessInfo(
  overrides: Partial<RemoteAccessInfo> = {},
): RemoteAccessInfo {
  return {
    enabled: true,
    running: true,
    connected: true,
    remote_id: REMOTE_ID,
    using_ha_cloud: false,
    signaling_url: "wss://signaling.example",
    ...overrides,
  };
}

/** The scopes this admin holds; everything, unless a test takes one away. */
function grantAllBut(...withheld: Scope[]) {
  authMock.hasScope.mockImplementation((scope) => !withheld.includes(scope));
}

async function mountStep() {
  const wrapper = mount(CoreSettingsStep, {
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountStep>>;

function testId(wrapper: Wrapper, id: string) {
  return wrapper.find(`[data-testid=${id}]`);
}

// the step's own way forward, which the wizard shows as its main button
const turnOn = (wrapper: Wrapper) =>
  (wrapper.vm as unknown as { primaryAction?: StepPrimaryAction })
    .primaryAction;
const turnOff = (wrapper: Wrapper) =>
  testId(wrapper, "onboarding-remote-access-turn-off");
const isOn = (wrapper: Wrapper) =>
  testId(wrapper, "onboarding-remote-access-on").exists();
const shownId = (wrapper: Wrapper) =>
  testId(wrapper, "onboarding-remote-access-id");
const note = (wrapper: Wrapper) =>
  testId(wrapper, "onboarding-invitation-note");
// what remote access brings through Home Assistant Link: a row of the list
// that invites, and of the one that shows it on
const homeAssistantLine = (wrapper: Wrapper) =>
  wrapper
    .findAll("[data-slot=item]")
    .find(
      (row) =>
        row.text() ===
        "onboarding.steps.core_settings.remote.features.home_assistant_link",
    );

beforeEach(() => {
  vi.clearAllMocks();
  grantAllBut();
  onboardingState.homeAssistantAddon = false;
  onboardingState.homeAssistantConfigured = false;
  onboardingState.homeAssistantConnected = false;
  apiMock.serverInfo.value = serverInfo();
  apiMock.getRemoteAccessInfo.mockResolvedValue(remoteAccessInfo());
  apiMock.configureRemoteAccess.mockImplementation(async (enabled) =>
    remoteAccessInfo({ enabled }),
  );
  copyMock.mockResolvedValue(true);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("CoreSettingsStep", () => {
  it("lists what remote access brings", async () => {
    const wrapper = await mountStep();

    expect(
      testId(wrapper, "onboarding-invitation-features")
        .findAll("[data-slot=item]")
        .map((item) => item.text()),
    ).toEqual([
      "onboarding.steps.core_settings.remote.features.secure",
      "onboarding.steps.core_settings.remote.features.no_setup",
      "onboarding.steps.core_settings.remote.features.anywhere",
    ]);
  });

  describe("while remote access is off", () => {
    it("offers to turn it on, as the step's main action", async () => {
      const wrapper = await mountStep();

      expect(turnOn(wrapper)?.labelKey).toBe(
        "onboarding.steps.core_settings.remote.turn_on",
      );
      expect(isOn(wrapper)).toBe(false);
      // the id is only worth asking for once remote access is on
      expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
    });

    it("says it is optional, and where to find it and a reverse proxy later", async () => {
      const wrapper = await mountStep();

      expect(note(wrapper).text()).toBe(
        "onboarding.steps.core_settings.optional",
      );
    });
  });

  describe("while remote access is on", () => {
    beforeEach(() => {
      apiMock.serverInfo.value = serverInfo(true);
    });

    it("says so, with the id, where to use it and no invitation", async () => {
      const wrapper = await mountStep();

      expect(isOn(wrapper)).toBe(true);
      expect(shownId(wrapper).text()).toContain(REMOTE_ID_GROUPED);
      expect(turnOn(wrapper)).toBeUndefined();
      expect(note(wrapper).text()).toBe(
        "onboarding.steps.core_settings.remote.builtin.hint",
      );
      expect(testId(wrapper, "onboarding-invitation-features").exists()).toBe(
        false,
      );
    });

    it("keeps the room for the id while it is being read", async () => {
      let answer: (info: RemoteAccessInfo) => void = () => {};
      apiMock.getRemoteAccessInfo.mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );

      const wrapper = await mountStep();

      // the block is there from the start, so nothing below it moves later
      expect(shownId(wrapper).exists()).toBe(true);
      expect(
        testId(wrapper, "onboarding-remote-access-id-loading").exists(),
      ).toBe(true);
      expect(shownId(wrapper).text()).not.toContain(REMOTE_ID_GROUPED);

      answer(remoteAccessInfo());
      await flushPromises();

      expect(
        testId(wrapper, "onboarding-remote-access-id-loading").exists(),
      ).toBe(false);
      expect(shownId(wrapper).text()).toContain(REMOTE_ID_GROUPED);
    });

    it("copies the id as it is read out", async () => {
      const wrapper = await mountStep();

      await testId(wrapper, "onboarding-remote-access-copy").trigger("click");
      await flushPromises();

      expect(copyMock).toHaveBeenCalledWith(REMOTE_ID_GROUPED);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.remote_access_id_copied",
      );
    });

    it("says so when the id could not be copied", async () => {
      copyMock.mockResolvedValue(false);

      const wrapper = await mountStep();

      await testId(wrapper, "onboarding-remote-access-copy").trigger("click");
      await flushPromises();

      expect(toastMock.error).toHaveBeenCalledWith(
        "settings.remote_access_error_copy",
      );
    });
  });

  describe("switching", () => {
    it("turns remote access on", async () => {
      const wrapper = await mountStep();

      turnOn(wrapper)?.run();
      await flushPromises();

      expect(apiMock.configureRemoteAccess).toHaveBeenCalledWith(true);
      expect(isOn(wrapper)).toBe(true);
      expect(shownId(wrapper).text()).toContain(REMOTE_ID_GROUPED);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.remote_access_enabled_success",
      );
    });

    it("turns remote access off again", async () => {
      apiMock.serverInfo.value = serverInfo(true);

      const wrapper = await mountStep();

      await turnOff(wrapper).trigger("click");
      await flushPromises();

      expect(apiMock.configureRemoteAccess).toHaveBeenCalledWith(false);
      expect(isOn(wrapper)).toBe(false);
      expect(turnOn(wrapper)).toBeDefined();
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.remote_access_disabled_success",
      );
    });

    it("shows the action as busy while the server answers", async () => {
      let answer: (info: RemoteAccessInfo) => void = () => {};
      apiMock.configureRemoteAccess.mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );

      const wrapper = await mountStep();
      turnOn(wrapper)?.run();
      await flushPromises();

      expect(turnOn(wrapper)?.busy).toBe(true);

      answer(remoteAccessInfo());
      await flushPromises();

      expect(isOn(wrapper)).toBe(true);
    });

    it("leaves remote access as it was when the server refuses", async () => {
      apiMock.configureRemoteAccess.mockRejectedValue(new Error("no"));

      const wrapper = await mountStep();

      turnOn(wrapper)?.run();
      await flushPromises();

      // the api tells the user itself; the step says what is still true
      expect(isOn(wrapper)).toBe(false);
      expect(turnOn(wrapper)).toBeDefined();
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("does not let a slow first read undo a switch answered since", async () => {
      apiMock.serverInfo.value = serverInfo(true);
      let answerFirstRead: (info: RemoteAccessInfo) => void = () => {};
      apiMock.getRemoteAccessInfo.mockImplementation(
        () =>
          new Promise((resolve) => {
            answerFirstRead = resolve;
          }),
      );

      const wrapper = await mountStep();
      await turnOff(wrapper).trigger("click");
      await flushPromises();

      // switched off, and only then does the read from the mount land
      answerFirstRead(remoteAccessInfo());
      await flushPromises();

      expect(isOn(wrapper)).toBe(false);
      expect(shownId(wrapper).exists()).toBe(false);
    });

    it("keeps a read still on its way when the server refuses to switch", async () => {
      apiMock.serverInfo.value = serverInfo(true);
      let answerFirstRead: (info: RemoteAccessInfo) => void = () => {};
      apiMock.getRemoteAccessInfo.mockImplementation(
        () =>
          new Promise((resolve) => {
            answerFirstRead = resolve;
          }),
      );
      apiMock.configureRemoteAccess.mockRejectedValue(new Error("no"));

      const wrapper = await mountStep();
      await turnOff(wrapper).trigger("click");
      await flushPromises();

      // remote access stayed on, so the id that read brings is still the truth
      answerFirstRead(remoteAccessInfo());
      await flushPromises();

      expect(isOn(wrapper)).toBe(true);
      expect(shownId(wrapper).text()).toContain(REMOTE_ID_GROUPED);
    });
  });

  describe("for whoever may not switch remote access", () => {
    beforeEach(() => {
      grantAllBut(Scope.SYSTEM_MANAGE);
    });

    it("offers no action and no optional line", async () => {
      onboardingState.homeAssistantConfigured = true;
      onboardingState.homeAssistantConnected = true;

      const wrapper = await mountStep();

      // the request would only fail at them, and the line about Home
      // Assistant goes with the action it is about
      expect(turnOn(wrapper)).toBeUndefined();
      expect(note(wrapper).exists()).toBe(false);
      expect(homeAssistantLine(wrapper)).toBeUndefined();
    });

    it("asks nothing about remote access that is on", async () => {
      apiMock.serverInfo.value = serverInfo(true);

      const wrapper = await mountStep();

      expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
      expect(isOn(wrapper)).toBe(false);
    });
  });

  describe("the line about Home Assistant", () => {
    it("is left out without Home Assistant", async () => {
      const wrapper = await mountStep();

      expect(homeAssistantLine(wrapper)).toBeUndefined();
    });

    it("shows with Home Assistant connected", async () => {
      onboardingState.homeAssistantConfigured = true;
      onboardingState.homeAssistantConnected = true;

      const wrapper = await mountStep();

      expect(homeAssistantLine(wrapper)).toBeDefined();
    });

    it("stays once remote access is on", async () => {
      apiMock.serverInfo.value = serverInfo(true);
      onboardingState.homeAssistantConfigured = true;
      onboardingState.homeAssistantConnected = true;

      const wrapper = await mountStep();

      expect(isOn(wrapper)).toBe(true);
      expect(homeAssistantLine(wrapper)).toBeDefined();
    });

    it("is left out while the Home Assistant connection does not work", async () => {
      // set up, but switched off or failed: the server only goes through
      // Home Assistant Link with a connection that is up
      onboardingState.homeAssistantConfigured = true;

      const wrapper = await mountStep();

      expect(homeAssistantLine(wrapper)).toBeUndefined();
    });

    it("shows on the add-on, which connects Home Assistant by itself", async () => {
      onboardingState.homeAssistantAddon = true;

      const wrapper = await mountStep();

      expect(homeAssistantLine(wrapper)).toBeDefined();
    });
  });

  it("has nothing to hold the wizard up over", async () => {
    const wrapper = await mountStep();

    // with no say in leaving, the wizard's Next moves on at once
    expect(
      (wrapper.vm as { beforeLeave?: unknown }).beforeLeave,
    ).toBeUndefined();
  });
});
