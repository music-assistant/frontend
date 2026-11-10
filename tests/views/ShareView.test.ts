import ShareView from "@/views/ShareView.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, routerMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    resolveSharedItem: vi.fn(),
  },
  routerMock: { replace: vi.fn() },
  storeMock: {
    enabledPlugins: new Set(["share_provider"]),
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-router", () => ({ useRouter: () => routerMock }));

function encode(payload: object): string {
  return btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => (resolve = complete));
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.resolveSharedItem.mockReset();
  storeMock.enabledPlugins = new Set(["share_provider"]);
});

describe("ShareView", () => {
  it("rejects playlist payloads without resolving them", async () => {
    const wrapper = mount(ShareView, {
      props: {
        payload: encode({
          type: "playlist",
          title: "Shared list",
          tracks: [{ title: "Track" }],
        }),
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("share.invalid_link");
    expect(apiMock.resolveSharedItem).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not resolve a supported payload when the plugin is unavailable", async () => {
    storeMock.enabledPlugins = new Set();
    const wrapper = mount(ShareView, {
      props: { payload: encode({ type: "track", title: "Track" }) },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("share.plugin_unavailable");
    expect(apiMock.resolveSharedItem).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each([
    ["track", "track"],
    ["album", "album"],
    ["artist", "artist"],
  ] as const)(
    "resolves %s links to the matching route",
    async (type, route) => {
      const item = {
        media_type: type,
        provider: "library",
        item_id: `${type}-id`,
      };
      apiMock.resolveSharedItem.mockResolvedValue(item);
      const wrapper = mount(ShareView, {
        props: { payload: encode({ type, title: `${type} title` }) },
      });
      await flushPromises();

      expect(routerMock.replace).toHaveBeenCalledWith({
        name: route,
        params: { provider: "library", itemId: `${type}-id` },
      });
      wrapper.unmount();
    },
  );

  it("ignores an old resolution after the payload changes", async () => {
    const pending = deferred<{
      media_type: string;
      provider: string;
      item_id: string;
    }>();
    const newItem = {
      media_type: "album",
      provider: "library",
      item_id: "new-album",
    };
    apiMock.resolveSharedItem
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(newItem);
    const wrapper = mount(ShareView, {
      props: { payload: encode({ type: "track", title: "Old track" }) },
    });

    await wrapper.setProps({
      payload: encode({ type: "album", title: "New album" }),
    });
    await flushPromises();
    pending.resolve({
      media_type: "track",
      provider: "library",
      item_id: "old-track",
    });
    await flushPromises();

    expect(routerMock.replace).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith({
      name: "album",
      params: { provider: "library", itemId: "new-album" },
    });
    wrapper.unmount();
  });

  it("ignores a resolution after leaving the share view", async () => {
    const pending = deferred<{
      media_type: string;
      provider: string;
      item_id: string;
    }>();
    apiMock.resolveSharedItem.mockReturnValueOnce(pending.promise);
    const wrapper = mount(ShareView, {
      props: { payload: encode({ type: "track", title: "Track" }) },
    });

    wrapper.unmount();
    pending.resolve({
      media_type: "track",
      provider: "library",
      item_id: "track-id",
    });
    await flushPromises();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
