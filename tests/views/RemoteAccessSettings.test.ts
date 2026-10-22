import { flushPromises, shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import type { MusicAssistantApi } from "@/plugins/api";
import type { RemoteAccessInfo } from "@/plugins/api/interfaces";
import RemoteAccessSettings from "@/views/settings/RemoteAccessSettings.vue";

const { apiMock, qrMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getRemoteAccessInfo: vi.fn<MusicAssistantApi["getRemoteAccessInfo"]>(),
    configureRemoteAccess: vi.fn<MusicAssistantApi["configureRemoteAccess"]>(),
  },
  qrMock: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr"),
  },
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("qrcode", () => ({
  default: qrMock,
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

const vuetify = createVuetify({ components, directives });

function remoteAccessInfo(): RemoteAccessInfo {
  return {
    enabled: true,
    running: true,
    connected: true,
    remote_id: "abcdefgh12345678901234ab",
    using_ha_cloud: true,
    signaling_url: "https://signaling.example.com",
  };
}

function mountView() {
  return shallowMount(RemoteAccessSettings, {
    global: {
      plugins: [vuetify],
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getRemoteAccessInfo.mockResolvedValue(remoteAccessInfo());
  qrMock.toDataURL.mockResolvedValue("data:image/png;base64,qr");
  // flushPromises() resolves on setImmediate, so that one has to stay real.
  // The status poll is what these tests drive.
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RemoteAccessSettings status poll", () => {
  it("polls the remote access status every five seconds until the page is closed", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(apiMock.getRemoteAccessInfo).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(apiMock.getRemoteAccessInfo).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(apiMock.getRemoteAccessInfo).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("arms no poll when the page is closed while the first status load is in flight", async () => {
    let deliverInfo: (info: RemoteAccessInfo) => void = () => {};
    apiMock.getRemoteAccessInfo.mockReturnValueOnce(
      new Promise<RemoteAccessInfo>((resolve) => {
        deliverInfo = resolve;
      }),
    );
    const wrapper = mountView();

    wrapper.unmount();
    deliverInfo(remoteAccessInfo());
    await flushPromises();
    await vi.advanceTimersByTimeAsync(15_000);

    // a leaked poll keeps asking the server for status for the rest of the
    // session
    expect(apiMock.getRemoteAccessInfo).toHaveBeenCalledTimes(1);
    // an interval survives being advanced past, so a count of zero is what
    // rules one out
    expect(vi.getTimerCount()).toBe(0);
  });
});
