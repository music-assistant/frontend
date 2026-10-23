import Toolbar from "@/components/Toolbar.vue";
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import { dropdownMenuStubs } from "../fixtures/dropdownMenu";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { reactive } from "vue";
import { getItemShareMenuItem } from "@/composables/useItemSharing";
import type { ItemShareInfo } from "@/plugins/api/sharing";
import { track } from "../fixtures/track";

const { getItemShareInfo, copyToClipboard } = vi.hoisted(() => ({
  getItemShareInfo: vi.fn(),
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/plugins/api", () => ({
  default: { state: { value: "initialized" }, getItemShareInfo },
}));
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => true },
}));
vi.mock("@/helpers/device", () => ({ IS_MOBILE_UA: false }));
vi.mock("@/helpers/utils", () => ({ copyToClipboard }));
vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/breakpoint", () => ({ getBreakpointValue: () => false }));
vi.mock("@/plugins/store", () => ({ store: {} }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

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
