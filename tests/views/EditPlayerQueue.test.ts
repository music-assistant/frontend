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

  it("leads to the playback defaults every queue follows", async () => {
    const wrapper = shallowMount(EditPlayerQueue, {
      props: { queueId: "kitchen" },
      global: {
        mocks: { $t: (key: string) => key },
        // the link sits in the slot of its button
        renderStubDefaultSlot: true,
      },
    });
    await flushPromises();

    expect(wrapper.findComponent({ name: "RouterLink" }).props("to")).toEqual({
      name: "playbacksettings",
    });
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

  it("keeps the other changes when one applies at once", async () => {
    const entry = (key: string, value: string) => ({
      key,
      type: "string",
      label: key,
      category: "generic",
      options: [],
      required: false,
      default_value: null,
      value,
    });
    apiMock.getPlayerQueueConfig.mockResolvedValueOnce({
      values: {
        crossfade: entry("crossfade", "off"),
        flow: entry("flow", "a"),
      },
    });
    apiMock.savePlayerQueueConfig.mockResolvedValueOnce({
      values: {
        crossfade: entry("crossfade", "off"),
        flow: entry("flow", "b"),
      },
    });
    const wrapper = mountWithForm();
    await flushPromises();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    const formEntry = (key: string) =>
      (
        editConfig.props("configEntries") as { key: string; value: unknown }[]
      ).find((configEntry) => configEntry.key === key)!;
    formEntry("crossfade").value = "smart_crossfade";
    formEntry("flow").value = "b";

    editConfig.vm.$emit("immediateApply", { flow: "b" });
    await flushPromises();

    expect(formEntry("crossfade").value).toBe("smart_crossfade");
    expect(formEntry("flow").value).toBe("b");
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
          props: ["configEntries"],
          template: "<div />",
          methods: { saveFailed },
        },
      },
    },
  });
}
