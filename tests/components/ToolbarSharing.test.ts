import Toolbar from "@/components/Toolbar.vue";
import { mount, flushPromises } from "@vue/test-utils";
import { beforeEach, expect, it, onTestFinished, vi } from "vitest";
import { dropdownMenuStubs } from "../fixtures/dropdownMenu";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { reactive } from "vue";
import { getItemShareMenuItem } from "@/composables/useItemSharing";
import type { ItemShareInfo } from "@/plugins/api/sharing";
import { track } from "../fixtures/track";

const { getItemShareInfo, copyToClipboard, toast, hasScope } = vi.hoisted(
  () => ({
    getItemShareInfo: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    copyToClipboard: vi.fn().mockResolvedValue(true),
    hasScope: vi.fn(),
  }),
);
vi.mock("@/plugins/api", () => ({
  default: {
    state: { value: "initialized" },
    getItemShareInfo,
    getProviderManifest: () => ({ name: "Spotify" }),
  },
}));
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope },
}));
vi.mock("@/helpers/device", () => ({ IS_MOBILE_UA: false }));
vi.mock("@/helpers/utils", () => ({ copyToClipboard }));
vi.mock("vue-sonner", () => ({ toast }));

vi.mock("@/plugins/breakpoint", () => ({ getBreakpointValue: () => false }));
vi.mock("@/plugins/store", () => ({ store: {} }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
});

it("preloads the detail toolbar action when overflow opens, then invokes the prepared action", async () => {
  const action = vi.fn();
  const item = reactive<ContextMenuItem>({
    label: "provider_links.share",
    disabled: true,
  });
  const prepare = vi.fn(async () => {
    item.action = action;
    item.disabled = false;
  });
  item.prepare = prepare;
  const wrapper = mount(Toolbar, {
    props: { enforceOverflowMenu: true, menuItems: [item] },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ...dropdownMenuStubs,
        VToolbar: { template: '<div><slot name="append" /></div>' },
      },
    },
  });
  expect(prepare).not.toHaveBeenCalled();
  await wrapper.get('[aria-label="menu"]').trigger("click");
  await flushPromises();
  expect(prepare).toHaveBeenCalledOnce();
  await wrapper.get(".dropdown-item").trigger("click");
  expect(action).toHaveBeenCalledOnce();
  wrapper.unmount();
});

it("prepares replacement sharing items while open and ignores stale responses", async () => {
  let resolveOld!: (info: ItemShareInfo) => void;
  let resolveCurrent!: (info: ItemShareInfo) => void;
  getItemShareInfo.mockReset();
  getItemShareInfo
    .mockImplementationOnce(
      () => new Promise<ItemShareInfo>((resolve) => (resolveOld = resolve)),
    )
    .mockImplementationOnce(
      () => new Promise<ItemShareInfo>((resolve) => (resolveCurrent = resolve)),
    );
  const oldItem = getItemShareMenuItem(track({ uri: "library://track/old" }))!;
  const currentItem = getItemShareMenuItem(
    track({ uri: "library://track/current" }),
  )!;
  const wrapper = mount(Toolbar, {
    props: { enforceOverflowMenu: true, menuItems: [oldItem] },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ...dropdownMenuStubs,
        VToolbar: { template: '<div><slot name="append" /></div>' },
      },
    },
  });
  await wrapper.get('[aria-label="menu"]').trigger("click");
  expect(getItemShareInfo).toHaveBeenCalledWith("library://track/old");
  await wrapper.setProps({ menuItems: [currentItem] });
  expect(wrapper.get(".dropdown").attributes("data-open")).toBe("true");
  expect(getItemShareInfo).toHaveBeenLastCalledWith("library://track/current");
  expect(wrapper.get(".dropdown-item").attributes("disabled")).toBeDefined();
  resolveCurrent({ title: "Current", text: "Current URI payload", links: [] });
  await flushPromises();
  expect(wrapper.get(".dropdown-item").attributes("disabled")).toBeUndefined();
  resolveOld({ title: "Old", text: "Old URI payload", links: [] });
  await flushPromises();
  expect(getItemShareInfo).toHaveBeenCalledTimes(2);
  await wrapper.get(".dropdown-item").trigger("click");
  expect(copyToClipboard).toHaveBeenLastCalledWith("Current URI payload");
  await wrapper.get(".dropdown-dismiss").trigger("click");
  await wrapper.setProps({
    menuItems: [
      getItemShareMenuItem(track({ uri: "library://track/closed" }))!,
    ],
  });
  await flushPromises();
  expect(getItemShareInfo).toHaveBeenCalledTimes(2);
  wrapper.unmount();
});

it("silently hides rejected sharing preloads, keeps other actions usable and retries on reopen", async () => {
  vi.clearAllMocks();
  getItemShareInfo.mockReset();
  getItemShareInfo
    .mockRejectedValueOnce(new Error("Unsupported URL item"))
    .mockResolvedValueOnce({ title: "Song", text: "Song", links: [] });
  const item = track({ uri: "url://track/example" });
  const otherAction = vi.fn();
  const wrapper = mount(Toolbar, {
    props: {
      enforceOverflowMenu: true,
      menuItems: [
        getItemShareMenuItem(item)!,
        { label: "other_action", action: otherAction },
      ],
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ...dropdownMenuStubs,
        VToolbar: { template: '<div><slot name="append" /></div>' },
      },
    },
  });
  expect(getItemShareInfo).not.toHaveBeenCalled();
  await wrapper.get('[aria-label="menu"]').trigger("click");
  await flushPromises();
  expect(getItemShareInfo).toHaveBeenCalledExactlyOnceWith(item.uri);
  expect(wrapper.findAll(".dropdown-item")).toHaveLength(1);
  expect(wrapper.get(".dropdown-item").text()).toBe("other_action");
  expect(toast.error).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.info).not.toHaveBeenCalled();
  await wrapper.get(".dropdown-item").trigger("click");
  expect(otherAction).toHaveBeenCalledOnce();
  await wrapper.get(".dropdown-dismiss").trigger("click");
  await wrapper.get('[aria-label="menu"]').trigger("click");
  await flushPromises();
  expect(getItemShareInfo).toHaveBeenCalledTimes(2);
  expect(getItemShareInfo).toHaveBeenLastCalledWith(item.uri);
  const share = wrapper
    .findAll(".dropdown-item")
    .find((entry) => entry.text() === "provider_links.share")!;
  expect(share.attributes("disabled")).toBeUndefined();
  await share.trigger("click");
  expect(copyToClipboard).toHaveBeenLastCalledWith("Song");
  expect(toast.success).toHaveBeenCalledWith("provider_links.copied");
  wrapper.unmount();
});

it.each(["success", "failure"])(
  "keeps the latest payload when an older preload completes with %s after reopening the same menu item",
  async (outcome) => {
    vi.clearAllMocks();
    getItemShareInfo.mockReset();
    const oldRequest = Promise.withResolvers<ItemShareInfo>();
    const currentRequest = Promise.withResolvers<ItemShareInfo>();
    getItemShareInfo
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const item = track();
    const shareItem = getItemShareMenuItem(item)!;
    const otherAction = vi.fn();
    const wrapper = mount(Toolbar, {
      props: {
        enforceOverflowMenu: true,
        menuItems: [shareItem, { label: "other_action", action: otherAction }],
      },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          ...dropdownMenuStubs,
          VToolbar: { template: '<div><slot name="append" /></div>' },
        },
      },
    });
    onTestFinished(() => wrapper.unmount());
    const share = () =>
      wrapper
        .findAll(".dropdown-item")
        .find((entry) => entry.text() === "provider_links.share");
    await wrapper.get('[aria-label="menu"]').trigger("click");
    expect(getItemShareInfo).toHaveBeenCalledExactlyOnceWith(item.uri);
    expect(share()!.attributes("disabled")).toBeDefined();
    const other = wrapper
      .findAll(".dropdown-item")
      .find((entry) => entry.text() === "other_action")!;
    expect(other.attributes("disabled")).toBeUndefined();
    await other.trigger("click");
    expect(otherAction).toHaveBeenCalledOnce();
    await wrapper.get(".dropdown-dismiss").trigger("click");
    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("false");
    await wrapper.get('[aria-label="menu"]').trigger("click");
    expect(wrapper.props("menuItems")![0]).toBe(shareItem);
    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("true");
    expect(getItemShareInfo).toHaveBeenCalledTimes(2);
    expect(getItemShareInfo).toHaveBeenLastCalledWith(item.uri);
    expect(share()!.attributes("disabled")).toBeDefined();

    const currentUrl = "https://open.spotify.com/track/current";
    currentRequest.resolve({
      title: "Current",
      text: null,
      links: [
        {
          provider_domain: "spotify",
          provider_instance: "spotify--1",
          url: currentUrl,
        },
      ],
    });
    await flushPromises();
    expect(share()!.attributes("disabled")).toBeUndefined();
    if (outcome === "success") {
      oldRequest.resolve({ title: "Old", text: "Old payload", links: [] });
    } else oldRequest.reject(new Error("Old lookup failed"));
    await flushPromises();

    expect(share()).toBeDefined();
    expect(share()!.attributes("disabled")).toBeUndefined();
    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    await share()!.trigger("click");
    await flushPromises();
    expect(copyToClipboard).toHaveBeenCalledExactlyOnceWith(currentUrl);
    expect(toast.success).toHaveBeenCalledWith("provider_links.copied");
    expect(getItemShareInfo).toHaveBeenCalledTimes(2);
  },
);

it.each(["during", "after"])(
  "silently removes sharing when access is revoked %s preload and only retries with restored access",
  async (timing) => {
    const access = reactive({ allowed: true });
    hasScope.mockImplementation(() => access.allowed);
    const request = Promise.withResolvers<ItemShareInfo>();
    getItemShareInfo.mockReset();
    getItemShareInfo
      .mockReturnValueOnce(request.promise)
      .mockResolvedValue({ title: "Fresh", text: "Fresh text", links: [] });
    const shareItem = getItemShareMenuItem(track())!;
    const otherAction = vi.fn();
    const wrapper = mount(Toolbar, {
      props: {
        enforceOverflowMenu: true,
        menuItems: [shareItem, { label: "other_action", action: otherAction }],
      },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          ...dropdownMenuStubs,
          DropdownMenuSub: {
            template: '<div class="share-submenu"><slot /></div>',
          },
          DropdownMenuSubTrigger: { template: "<button><slot /></button>" },
          DropdownMenuSubContent: { template: "<div><slot /></div>" },
          VToolbar: { template: '<div><slot name="append" /></div>' },
        },
      },
    });
    onTestFinished(() => wrapper.unmount());
    await wrapper.get('[aria-label="menu"]').trigger("click");
    expect(getItemShareInfo).toHaveBeenCalledOnce();
    if (timing === "during") access.allowed = false;
    request.resolve({
      title: "Song",
      text: null,
      links: ["spotify", "ytmusic"].map((provider) => ({
        provider_domain: provider,
        provider_instance: `${provider}--1`,
        url: `https://example.com/${provider}/song`,
      })),
    });
    await flushPromises();
    if (timing === "after") {
      expect(wrapper.findAll(".share-submenu .dropdown-item")).toHaveLength(2);
      access.allowed = false;
      await flushPromises();
    }

    expect(wrapper.find(".share-submenu").exists()).toBe(false);
    expect(wrapper.findAll(".dropdown-item")).toHaveLength(1);
    expect(wrapper.get(".dropdown-item").text()).toBe("other_action");
    expect(shareItem.disabled).toBe(true);
    expect(shareItem.action).toBeUndefined();
    expect(shareItem.subItems).toBeUndefined();
    expect(copyToClipboard).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    await wrapper.get(".dropdown-item").trigger("click");
    expect(otherAction).toHaveBeenCalledOnce();
    await wrapper.get(".dropdown-dismiss").trigger("click");
    await wrapper.get('[aria-label="menu"]').trigger("click");
    await flushPromises();
    expect(getItemShareInfo).toHaveBeenCalledOnce();
    expect(shareItem.hide).toBe(true);

    access.allowed = true;
    await flushPromises();
    expect(shareItem.action).toBeUndefined();
    expect(shareItem.subItems).toBeUndefined();
    expect(getItemShareInfo).toHaveBeenCalledOnce();
    await wrapper.get(".dropdown-dismiss").trigger("click");
    await wrapper.get('[aria-label="menu"]').trigger("click");
    await flushPromises();
    expect(getItemShareInfo).toHaveBeenCalledTimes(2);
    const share = wrapper
      .findAll(".dropdown-item")
      .find((entry) => entry.text() === "provider_links.share")!;
    expect(share.attributes("disabled")).toBeUndefined();
    await share.trigger("click");
    await flushPromises();
    expect(copyToClipboard).toHaveBeenCalledExactlyOnceWith("Fresh text");
    expect(toast.success).toHaveBeenCalledWith("provider_links.copied");
    expect(toast.error).not.toHaveBeenCalled();
  },
);

it("reports a denied click before the open menu has rendered the access change", async () => {
  const access = reactive({ allowed: true });
  hasScope.mockImplementation(() => access.allowed);
  getItemShareInfo.mockResolvedValue({
    title: "Song",
    text: "Song",
    links: [],
  });
  const wrapper = mount(Toolbar, {
    props: {
      enforceOverflowMenu: true,
      menuItems: [getItemShareMenuItem(track())!],
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ...dropdownMenuStubs,
        VToolbar: { template: '<div><slot name="append" /></div>' },
      },
    },
  });
  onTestFinished(() => wrapper.unmount());
  await wrapper.get('[aria-label="menu"]').trigger("click");
  await flushPromises();
  const share = wrapper.get(".dropdown-item");
  access.allowed = false;
  await share.trigger("click");
  await flushPromises();
  expect(copyToClipboard).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledExactlyOnceWith(
    "provider_links.copy_failed",
  );
});
