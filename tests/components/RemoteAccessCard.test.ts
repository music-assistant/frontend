import RemoteAccessCard from "@/components/onboarding/RemoteAccessCard.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type {
  RemoteAccessInfo,
  ServerInfoMessage,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ref } from "vue";

const { apiMock, copyMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    configureRemoteAccess: vi.fn<MusicAssistantApi["configureRemoteAccess"]>(),
    getRemoteAccessInfo: vi.fn<MusicAssistantApi["getRemoteAccessInfo"]>(),
    // replaced with a real ref by the api mock factory below
    serverInfo: { value: undefined } as Ref<ServerInfoMessage | undefined>,
  },
  copyMock: vi.fn<(text: string) => Promise<boolean>>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.serverInfo = ref<ServerInfoMessage | undefined>(undefined);
  return { api: apiMock, default: apiMock };
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

async function mountCard() {
  const wrapper = mount(RemoteAccessCard);
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountCard>>;

function toggle(wrapper: Wrapper) {
  return wrapper.find("[data-testid=onboarding-remote-access-switch]");
}

function shownId(wrapper: Wrapper) {
  return wrapper.find("[data-testid=onboarding-remote-access-id]");
}

beforeEach(() => {
  vi.clearAllMocks();
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

describe("RemoteAccessCard", () => {
  it("shows remote access as off, and asks for no details", async () => {
    const wrapper = await mountCard();

    expect(toggle(wrapper).attributes("data-state")).toBe("unchecked");
    expect(shownId(wrapper).exists()).toBe(false);
    // the id is only worth asking for once remote access is on
    expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
  });

  it("shows the id when remote access is already on", async () => {
    apiMock.serverInfo.value = serverInfo(true);

    const wrapper = await mountCard();

    expect(toggle(wrapper).attributes("data-state")).toBe("checked");
    expect(shownId(wrapper).text()).toContain(REMOTE_ID_GROUPED);
  });

  it("keeps the room for the id while it is being read", async () => {
    apiMock.serverInfo.value = serverInfo(true);
    let answer: (info: RemoteAccessInfo) => void = () => {};
    apiMock.getRemoteAccessInfo.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );

    const wrapper = await mountCard();

    // the block is there from the start, so nothing below it moves later
    expect(shownId(wrapper).exists()).toBe(true);
    expect(
      wrapper
        .find("[data-testid=onboarding-remote-access-id-loading]")
        .exists(),
    ).toBe(true);
    expect(shownId(wrapper).text()).not.toContain(REMOTE_ID_GROUPED);

    answer(remoteAccessInfo());
    await flushPromises();

    expect(
      wrapper
        .find("[data-testid=onboarding-remote-access-id-loading]")
        .exists(),
    ).toBe(false);
    expect(shownId(wrapper).text()).toContain(REMOTE_ID_GROUPED);
  });

  it("turns remote access on", async () => {
    const wrapper = await mountCard();

    await toggle(wrapper).trigger("click");
    await flushPromises();

    expect(apiMock.configureRemoteAccess).toHaveBeenCalledWith(true);
    expect(toggle(wrapper).attributes("data-state")).toBe("checked");
    expect(shownId(wrapper).text()).toContain(REMOTE_ID_GROUPED);
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.remote_access_enabled_success",
    );
  });

  it("turns remote access off again", async () => {
    apiMock.serverInfo.value = serverInfo(true);

    const wrapper = await mountCard();

    await toggle(wrapper).trigger("click");
    await flushPromises();

    expect(apiMock.configureRemoteAccess).toHaveBeenCalledWith(false);
    expect(toggle(wrapper).attributes("data-state")).toBe("unchecked");
    expect(shownId(wrapper).exists()).toBe(false);
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.remote_access_disabled_success",
    );
  });

  it("leaves the switch where it was when the server refuses", async () => {
    apiMock.configureRemoteAccess.mockRejectedValue(new Error("no"));

    const wrapper = await mountCard();

    await toggle(wrapper).trigger("click");
    await flushPromises();

    // the api tells the user itself; the switch says what is still true
    expect(toggle(wrapper).attributes("data-state")).toBe("unchecked");
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

    const wrapper = await mountCard();
    await toggle(wrapper).trigger("click");
    await flushPromises();

    // switched off, and only then does the read from the mount land
    answerFirstRead(remoteAccessInfo());
    await flushPromises();

    expect(toggle(wrapper).attributes("data-state")).toBe("unchecked");
    expect(shownId(wrapper).exists()).toBe(false);
  });

  it("copies the id as it is read out", async () => {
    apiMock.serverInfo.value = serverInfo(true);

    const wrapper = await mountCard();

    await wrapper
      .find("[data-testid=onboarding-remote-access-copy]")
      .trigger("click");
    await flushPromises();

    expect(copyMock).toHaveBeenCalledWith(REMOTE_ID_GROUPED);
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.remote_access_id_copied",
    );
  });

  it("says so when the id could not be copied", async () => {
    apiMock.serverInfo.value = serverInfo(true);
    copyMock.mockResolvedValue(false);

    const wrapper = await mountCard();

    await wrapper
      .find("[data-testid=onboarding-remote-access-copy]")
      .trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(
      "settings.remote_access_error_copy",
    );
  });
});
