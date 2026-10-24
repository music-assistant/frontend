import ShareView from "@/views/ShareView.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    resolveSharedItem: vi.fn(),
    importSharedPlaylist: vi.fn(),
  },
  routerMock: { replace: vi.fn(), push: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock }));
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => true },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/helpers/navigation", () => ({ backFromMediaDetails: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => routerMock }));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/components/Toolbar.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/share/SharedPlaylistTracks.vue", () => ({
  default: { template: "<div data-playlist-tracks />" },
}));
vi.mock("@/components/details/DetailHeroFacts.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/ui/button", () => ({
  Button: {
    props: ["disabled"],
    emits: ["click"],
    template:
      '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}));
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: { template: "<div />" },
}));
vi.mock("@/components/ui/dialog", () => {
  const wrapper = {
    props: ["open"],
    emits: ["update:open"],
    template: '<div v-if="open"><slot /></div>',
  };
  return {
    Dialog: { ...wrapper, name: "Dialog" },
    DialogContent: { template: "<div><slot /></div>" },
    DialogDescription: { template: "<div><slot /></div>" },
    DialogFooter: { template: "<div><slot /></div>" },
    DialogHeader: { template: "<div><slot /></div>" },
    DialogTitle: { template: "<div><slot /></div>" },
  };
});

function encode(payload: object): string {
  return btoa(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function playlist(title: string): string {
  return encode({ type: "playlist", title, tracks: [{ title: "Track" }] });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => (resolve = complete));
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShareView async state", () => {
  it("ignores an old resolution after the payload changes", async () => {
    const pending = deferred<{
      media_type: string;
      provider: string;
      item_id: string;
    }>();
    apiMock.resolveSharedItem.mockReturnValueOnce(pending.promise);
    const wrapper = mount(ShareView, {
      props: {
        payload: encode({ type: "track", title: "Old track" }),
      },
    });

    await wrapper.setProps({ payload: playlist("New playlist") });
    pending.resolve({
      media_type: "track",
      provider: "library",
      item_id: "old",
    });
    await flushPromises();

    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("New playlist");
    wrapper.unmount();
  });

  it("ignores an old resolution after leaving the share view", async () => {
    const pending = deferred<{
      media_type: string;
      provider: string;
      item_id: string;
    }>();
    apiMock.resolveSharedItem.mockReturnValueOnce(pending.promise);
    const wrapper = mount(ShareView, {
      props: { payload: encode({ type: "track", title: "Old track" }) },
    });

    wrapper.unmount();
    pending.resolve({
      media_type: "track",
      provider: "library",
      item_id: "old",
    });
    await flushPromises();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("closes the old import confirmation when the payload changes", async () => {
    const wrapper = mount(ShareView, {
      props: { payload: playlist("Playlist A") },
    });
    const importButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("share.import"));
    await importButton?.trigger("click");
    expect(wrapper.getComponent({ name: "Dialog" }).props("open")).toBe(true);

    await wrapper.setProps({ payload: playlist("Playlist B") });

    expect(wrapper.getComponent({ name: "Dialog" }).props("open")).toBe(false);
    expect(apiMock.importSharedPlaylist).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not import a new payload after confirming an older playlist", async () => {
    const wrapper = mount(ShareView, {
      props: { payload: playlist("Playlist A") },
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("share.import"))
      ?.trigger("click");
    await wrapper.setProps({ payload: playlist("Playlist B") });
    expect(
      wrapper
        .findAll("button")
        .some((button) => button.text().includes("share.confirm_import")),
    ).toBe(false);
    expect(apiMock.importSharedPlaylist).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("ignores an old import response after the payload changes", async () => {
    const pending = deferred<{
      media_type: string;
      provider: string;
      item_id: string;
    }>();
    const oldPayload = playlist("Playlist A");
    apiMock.importSharedPlaylist.mockReturnValueOnce(pending.promise);
    const wrapper = mount(ShareView, { props: { payload: oldPayload } });

    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "share.import")
      ?.trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "share.confirm_import")
      ?.trigger("click");
    expect(apiMock.importSharedPlaylist).toHaveBeenCalledWith(oldPayload);

    await wrapper.setProps({ payload: playlist("Playlist B") });
    pending.resolve({
      media_type: "playlist",
      provider: "library",
      item_id: "playlist-a",
    });
    await flushPromises();

    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Playlist B");
    wrapper.unmount();
  });

  it("ignores an import response after leaving the share view", async () => {
    const pending = deferred<{
      media_type: string;
      provider: string;
      item_id: string;
    }>();
    apiMock.importSharedPlaylist.mockReturnValueOnce(pending.promise);
    const wrapper = mount(ShareView, {
      props: { payload: playlist("Playlist A") },
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "share.import")
      ?.trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "share.confirm_import")
      ?.trigger("click");
    wrapper.unmount();
    pending.resolve({
      media_type: "playlist",
      provider: "library",
      item_id: "playlist-a",
    });
    await flushPromises();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("decodes a playlist payload larger than one MiB from a URL fragment", () => {
    const encoded = encode({
      type: "playlist",
      title: "Large playlist",
      tracks: Array.from({ length: 7000 }, (_, index) => ({
        title: `Track ${index} ${"x".repeat(100)}`,
      })),
    });
    const shareUrl = new URL(`https://share.music-assistant.io/#${encoded}`);

    expect(shareUrl.hash.length).toBeGreaterThan(1024 * 1024);
    const wrapper = mount(ShareView, {
      props: { payload: shareUrl.hash.slice(1) },
    });

    expect(wrapper.text()).toContain("Large playlist");
    wrapper.unmount();
  });
});
