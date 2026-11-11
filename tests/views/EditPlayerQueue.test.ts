import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiCommandError } from "@/plugins/api/errors";
import EditPlayerQueue from "@/views/settings/EditPlayerQueue.vue";

const REASON = "The value for Crossfade mode is not valid.";

const { apiMock, routerMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getPlayerQueueConfig: vi.fn(async () => ({ values: {} })),
    savePlayerQueueConfig: vi.fn(),
    queues: {},
    serverInfo: { value: undefined },
  },
  routerMock: { push: vi.fn() },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => routerMock,
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditPlayerQueue", () => {
  it("links the queue settings documentation", async () => {
    const wrapper = shallowMount(EditPlayerQueue, {
      props: { queueId: "kitchen" },
      global: { mocks: { $t: (key: string) => key } },
    });
    await flushPromises();

    expect(
      wrapper
        .findComponent({ name: "SettingsHeaderCard" })
        .props("documentationUrl"),
    ).toBe(
      "https://music-assistant.io/settings/individual-player/#queue-settings",
    );
  });

  it("stays on the form when the server refuses the save", async () => {
    apiMock.savePlayerQueueConfig.mockRejectedValueOnce(
      new ApiCommandError(REASON, 1, REASON),
    );
    const saveFailed = vi.fn();
    const wrapper = mountWithForm(saveFailed);
    await flushPromises();

    wrapper.findComponent({ name: "EditConfig" }).vm.$emit("submit", {
      crossfade: "smart_crossfade",
    });
    await flushPromises();

    expect(saveFailed).toHaveBeenCalledOnce();
    expect(routerMock.push).not.toHaveBeenCalled();
    // the api toasts a refused save itself
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("leaves reporting a refused immediate change to the api", async () => {
    apiMock.savePlayerQueueConfig.mockRejectedValueOnce(
      new ApiCommandError(REASON, 1, REASON),
    );
    const wrapper = mountWithForm();
    await flushPromises();

    wrapper.findComponent({ name: "EditConfig" }).vm.$emit("immediateApply", {
      crossfade: "smart_crossfade",
    });
    await flushPromises();

    expect(apiMock.savePlayerQueueConfig).toHaveBeenCalledWith("kitchen", {
      crossfade: "smart_crossfade",
    });
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

// the form is stubbed with the method the page calls on a refused save
function mountWithForm(saveFailed = vi.fn()) {
  return shallowMount(EditPlayerQueue, {
    props: { queueId: "kitchen" },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        EditConfig: {
          name: "EditConfig",
          template: "<div />",
          methods: { saveFailed },
        },
      },
    },
  });
}
