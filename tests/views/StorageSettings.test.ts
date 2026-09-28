import NetworkShareDialog from "@/components/settings/storage/NetworkShareDialog.vue";
import RemoveLocationDialog from "@/components/settings/storage/RemoveLocationDialog.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  StorageKind,
  type StorageLocation,
  StorageUsage,
} from "@/plugins/api/interfaces";
import StorageSettings from "@/views/settings/StorageSettings.vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import {
  managedShare,
  storageInfo,
  storageLocation,
} from "../fixtures/storage";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: { value: { server_version: "2.11.0" } },
    getStorageInfo: vi.fn<MusicAssistantApi["getStorageInfo"]>(),
    reloadNetworkShare: vi.fn<MusicAssistantApi["reloadNetworkShare"]>(),
    removeNetworkShare: vi.fn<MusicAssistantApi["removeNetworkShare"]>(),
    removeLocalFolder: vi.fn<MusicAssistantApi["removeLocalFolder"]>(),
  },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale,
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key, locale: ref("en") }),
}));

const media = storageLocation();
const share = managedShare();
const folder = storageLocation({
  path: "/home/me/Music",
  name: "Music",
  kind: StorageKind.MANUAL,
  managed: true,
});
const dataDir = storageLocation({
  path: "/data",
  name: "Data",
  usage: StorageUsage.DATA,
  kind: StorageKind.LOCAL_DISK,
  used_space_gb: 12.4,
  free_space_gb: 41,
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getStorageInfo.mockResolvedValue(
    storageInfo({ locations: [media, share, folder, dataDir] }),
  );
  apiMock.reloadNetworkShare.mockResolvedValue(share);
  apiMock.removeNetworkShare.mockResolvedValue();
  apiMock.removeLocalFolder.mockResolvedValue();
});

describe("StorageSettings", () => {
  it("offers to add a network share where the install can mount one", async () => {
    const wrapper = await mountPage();

    expect(exists(wrapper, "storage-add-share")).toBe(true);
    expect(exists(wrapper, "storage-add-folder")).toBe(false);
    expect(exists(wrapper, "storage-mount-hint")).toBe(false);
  });

  it("offers to add a folder only where the server allows it", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ can_add_local_folder: true }),
    );

    const wrapper = await mountPage();

    expect(exists(wrapper, "storage-add-folder")).toBe(true);
  });

  it("explains how to add a share where the install cannot mount one", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ can_mount_shares: false, supported_share_types: [] }),
    );

    const wrapper = await mountPage();

    expect(exists(wrapper, "storage-add-share")).toBe(false);
    const hint = wrapper.get('[data-testid="storage-mount-hint"]');
    expect(hint.text()).toContain("settings.storage.cannot_mount_text");
    expect(hint.get("a").attributes("href")).toBe(
      "https://music-assistant.io/installation/",
    );
  });

  it("offers each music location the actions it supports", async () => {
    const wrapper = await mountPage();

    expect(actionsOf(wrapper, media)).toEqual([]);
    expect(actionsOf(wrapper, share)).toEqual([
      "storage-reload",
      "storage-edit",
      "storage-remove",
    ]);
    expect(actionsOf(wrapper, folder)).toEqual(["storage-remove"]);
    expect(row(wrapper, share).text()).toContain(
      "settings.storage.share_summary_via_ha",
    );
  });

  it("lists the server's own storage apart from the music locations", async () => {
    const wrapper = await mountPage();

    const music = wrapper.get('[data-testid="storage-music-locations"]');
    const server = wrapper.get('[data-testid="storage-server"]');
    expect(music.text()).not.toContain("/data");
    expect(server.text()).toContain("/data");
    expect(server.text()).toContain("settings.storage.used_space");
    expect(server.text()).toContain("settings.storage.free_space");
  });

  it("shows an empty state without music locations", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [dataDir] }),
    );

    const wrapper = await mountPage();

    expect(exists(wrapper, "storage-empty")).toBe(true);
  });

  it("reloads a network share and fetches the storage again", async () => {
    const wrapper = await mountPage();

    await row(wrapper, share)
      .get('[data-testid="storage-reload"]')
      .trigger("click");
    await flushPromises();

    expect(apiMock.reloadNetworkShare).toHaveBeenCalledWith("nas_music");
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.storage.share_reloaded",
    );
    expect(apiMock.getStorageInfo).toHaveBeenCalledTimes(2);
  });

  it("opens the share dialog on the share to edit", async () => {
    const wrapper = await mountPage();

    await row(wrapper, share)
      .get('[data-testid="storage-edit"]')
      .trigger("click");

    const dialog = wrapper.findComponent(NetworkShareDialog);
    expect(dialog.props("open")).toBe(true);
    expect(dialog.props("location")).toEqual(share);
  });

  it("removes a network share and a folder once confirmed", async () => {
    const wrapper = await mountPage();
    const dialog = wrapper.findComponent(RemoveLocationDialog);

    await row(wrapper, share)
      .get('[data-testid="storage-remove"]')
      .trigger("click");
    // asks first
    expect(dialog.props("location")).toEqual(share);
    expect(apiMock.removeNetworkShare).not.toHaveBeenCalled();

    dialog.vm.$emit("confirm", share);
    await flushPromises();
    dialog.vm.$emit("confirm", folder);
    await flushPromises();

    expect(apiMock.removeNetworkShare).toHaveBeenCalledWith("nas_music");
    expect(apiMock.removeLocalFolder).toHaveBeenCalledWith("/home/me/Music");
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.storage.folder_removed",
    );
  });

  it("reports why the server refused a removal", async () => {
    const reason = "A music source still uses this share.";
    apiMock.removeNetworkShare.mockRejectedValue(
      new ApiCommandError(reason, 1, reason),
    );
    const wrapper = await mountPage();

    wrapper.findComponent(RemoveLocationDialog).vm.$emit("confirm", share);
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(reason);
    expect(apiMock.getStorageInfo).toHaveBeenCalledTimes(2);
  });
});

async function mountPage(): Promise<VueWrapper> {
  const wrapper = mount(StorageSettings, {
    global: {
      mocks: { $t: (key: string) => key },
      // covered by their own tests; here only the props they get matter
      stubs: {
        NetworkShareDialog: true,
        LocalFolderDialog: true,
        RemoveLocationDialog: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function exists(wrapper: VueWrapper, testId: string): boolean {
  return wrapper.find(`[data-testid="${testId}"]`).exists();
}

function locationRows(wrapper: VueWrapper) {
  return wrapper
    .get('[data-testid="storage-music-locations"]')
    .findAll('[data-testid="storage-location"]');
}

function row(wrapper: VueWrapper, location: StorageLocation) {
  return wrapper.get(
    `[data-testid="storage-location"][data-path="${location.path}"]`,
  );
}

function actionsOf(wrapper: VueWrapper, location: StorageLocation): string[] {
  return row(wrapper, location)
    .findAll("button")
    .map((button) => button.attributes("data-testid") ?? "");
}
