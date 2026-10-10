import { flushPromises, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import EditPlayerQueue from "@/views/settings/EditPlayerQueue.vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getPlayerQueueConfig: vi.fn(async () => ({ values: {} })),
    queues: {},
    serverInfo: { value: undefined },
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));

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
});
