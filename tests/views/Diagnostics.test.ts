import { flushPromises, shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicAssistantApi } from "@/plugins/api";
import Diagnostics from "@/views/settings/Diagnostics.vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    sendCommand: vi.fn<MusicAssistantApi["sendCommand"]>(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

const LOG_TEXT = "server started";

function mountView() {
  return shallowMount(Diagnostics, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.sendCommand.mockResolvedValue(LOG_TEXT as never);
  // flushPromises() resolves on setImmediate, so that one has to stay real.
  // The refresh interval and the log view's scroll timeout are what these
  // tests drive.
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Diagnostics log refresh", () => {
  it("refreshes the log every five seconds until the page is closed", async () => {
    const wrapper = mountView();
    await flushPromises();

    // auto-refresh starts switched on, so mounting takes the branch that arms
    // the interval; if that default ever changes this is what fails first
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("arms no refresh interval when the page is closed while the first log fetch is in flight", async () => {
    let deliverLog: (text: string) => void = () => {};
    apiMock.sendCommand.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        deliverLog = resolve;
      }) as never,
    );
    const wrapper = mountView();

    wrapper.unmount();
    deliverLog(LOG_TEXT);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(15_000);

    // a leaked interval keeps pulling the log down for the rest of the session
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    // an interval survives being advanced past, so a count of zero is what
    // rules one out
    expect(vi.getTimerCount()).toBe(0);
  });
});
