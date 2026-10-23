import NetworkShareDialog from "@/components/settings/storage/NetworkShareDialog.vue";
import RemoveLocationDialog from "@/components/settings/storage/RemoveLocationDialog.vue";
import StorageLocationRow from "@/components/settings/storage/StorageLocationRow.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  StorageKind,
  type StorageLocation,
  StorageUsage,
} from "@/plugins/api/interfaces";
import StorageSettings from "@/views/settings/StorageSettings.vue";
import {
  type DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import {
  managedShare,
  storageInfo,
  storageLocation,
} from "../fixtures/storage";

const { apiMock, eventbusMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: {
      value: { server_version: "2.11.0", homeassistant_addon: false },
    },
    getStorageInfo: vi.fn<MusicAssistantApi["getStorageInfo"]>(),
    reloadNetworkShare: vi.fn<MusicAssistantApi["reloadNetworkShare"]>(),
    removeNetworkShare: vi.fn<MusicAssistantApi["removeNetworkShare"]>(),
    removeLocalFolder: vi.fn<MusicAssistantApi["removeLocalFolder"]>(),
  },
  eventbusMock: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
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
  apiMock.serverInfo.value.homeassistant_addon = false;
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

  it("points a Home Assistant app that cannot mount a share to Home Assistant", async () => {
    apiMock.serverInfo.value.homeassistant_addon = true;
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ can_mount_shares: false, supported_share_types: [] }),
    );

    const wrapper = await mountPage();

    expect(exists(wrapper, "storage-add-share")).toBe(false);
    const hint = wrapper.get('[data-testid="storage-mount-hint"]');
    expect(hint.text()).toContain("settings.storage.cannot_mount_ha_title");
    expect(hint.text()).toContain("settings.storage.cannot_mount_ha_text");
    expect(hint.text()).not.toContain("container");
    expect(hint.get("a").attributes("href")).toBe(
      "https://music-assistant.io/settings/storage/",
    );
  });

  it("shows no hint to a Home Assistant app that can mount a share", async () => {
    apiMock.serverInfo.value.homeassistant_addon = true;

    const wrapper = await mountPage();

    expect(exists(wrapper, "storage-add-share")).toBe(true);
    expect(exists(wrapper, "storage-mount-hint")).toBe(false);
  });

  it("points a container that cannot mount a share to the host", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ can_mount_shares: false, supported_share_types: [] }),
    );

    const wrapper = await mountPage();

    expect(exists(wrapper, "storage-add-share")).toBe(false);
    const hint = wrapper.get('[data-testid="storage-mount-hint"]');
    expect(hint.text()).toContain(
      "settings.storage.cannot_mount_container_text",
    );
    expect(hint.text()).not.toContain("cannot_mount_ha");
    expect(hint.get("a").attributes("href")).toBe(
      "https://music-assistant.io/installation/#with-docker",
    );
  });

  it("points a server without a container that cannot mount a share to adding its folder", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({
        can_mount_shares: false,
        supported_share_types: [],
        can_add_local_folder: true,
      }),
    );

    const wrapper = await mountPage();

    const hint = wrapper.get('[data-testid="storage-mount-hint"]');
    expect(hint.text()).toContain("settings.storage.cannot_mount_host_text");
    expect(hint.text()).not.toContain("container");
    expect(hint.text()).not.toContain("cannot_mount_ha");
    expect(hint.find("a").exists()).toBe(false);
    // the button the notice sends the user to
    expect(exists(wrapper, "storage-add-folder")).toBe(true);
  });

  it("offers each music location the actions it supports", async () => {
    const wrapper = await mountPage();

    expect(actionsOf(wrapper, media)).toEqual(["storage-use-as-source"]);
    expect(actionsOf(wrapper, share)).toEqual([
      "storage-use-as-source",
      "storage-reload",
      "storage-edit",
      "storage-remove",
    ]);
    expect(actionsOf(wrapper, folder)).toEqual([
      "storage-use-as-source",
      "storage-remove",
    ]);
    expect(row(wrapper, share).text()).toContain(
      "settings.storage.share_summary_via_ha",
    );
  });

  it("names the sources that use a location and keeps it from being removed", async () => {
    const inUse = storageLocation({
      ...folder,
      used_by: ["Local files", "Audiobooks"],
    });
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [inUse, share] }),
    );

    const wrapper = await mountPage();

    const inUseRow = row(wrapper, inUse);
    // the line naming the sources also says why the location can not be removed
    expect(inUseRow.get('[data-testid="storage-used-by"]').text()).toBe(
      "settings.storage.remove_in_use",
    );
    const remove = inUseRow.get('[data-testid="storage-remove"]');
    expect(remove.attributes("disabled")).toBeDefined();
    // the reason sits on the wrapper, as a disabled button takes no pointer
    expect(remove.element.parentElement?.getAttribute("title")).toBe(
      "settings.storage.remove_in_use",
    );
    // and screen readers hear it with the button
    const describedBy = remove.attributes("aria-describedby");
    expect(inUseRow.get(`#${describedBy}`).text()).toBe(
      "settings.storage.remove_in_use",
    );
    // a location nobody uses can still be removed
    expect(
      row(wrapper, share)
        .get('[data-testid="storage-remove"]')
        .attributes("disabled"),
    ).toBeUndefined();
  });

  it("names the sources reading through a location, and lets it be removed", async () => {
    const readThrough = managedShare({ read_by: ["Local files"] });
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [readThrough] }),
    );

    const wrapper = await mountPage();

    const shareRow = row(wrapper, readThrough);
    expect(shareRow.get('[data-testid="storage-read-by"]').text()).toBe(
      "settings.storage.read_by",
    );
    expect(shareRow.find('[data-testid="storage-used-by"]').exists()).toBe(
      false,
    );
    // only a source whose own folder is in the location keeps it from going
    expect(isDisabled(shareRow.get('[data-testid="storage-remove"]'))).toBe(
      false,
    );
  });

  it("names who uses and who also reads a location, and blocks its removal", async () => {
    const both = managedShare({
      used_by: ["Audiobooks"],
      read_by: ["Local files"],
    });
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [both] }),
    );

    const wrapper = await mountPage();

    const shareRow = row(wrapper, both);
    expect(shareRow.get('[data-testid="storage-used-by"]').text()).toBe(
      "settings.storage.remove_in_use",
    );
    expect(shareRow.get('[data-testid="storage-read-by"]').text()).toBe(
      "settings.storage.read_by",
    );
    expect(isDisabled(shareRow.get('[data-testid="storage-remove"]'))).toBe(
      true,
    );
  });

  it("names no sources for a location nobody reads", async () => {
    const wrapper = await mountPage();

    expect(
      row(wrapper, share).find('[data-testid="storage-read-by"]').exists(),
    ).toBe(false);
  });

  it("names each source under the innermost location that holds its folder", async () => {
    const mediaFolder = storageLocation({
      used_by: ["Local files", "Filesystem (remote share)"],
    });
    const nas = managedShare({
      path: "/media/nas_music",
      used_by: ["Filesystem (remote share)"],
    });
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [mediaFolder, nas] }),
    );

    const wrapper = await mountPage();

    const shownOn = (location: StorageLocation) =>
      wrapper
        .findAllComponents(StorageLocationRow)
        .find((row) => row.props("location").path === location.path)
        ?.props("shownUsedBy");
    expect(shownOn(mediaFolder)).toEqual(["Local files"]);
    expect(shownOn(nas)).toEqual(["Filesystem (remote share)"]);
  });

  it("offers only an available music location no source reads as a music source", async () => {
    const used = storageLocation({ ...folder, used_by: ["Audiobooks"] });
    const readThrough = managedShare({ read_by: ["Local files"] });
    const gone = storageLocation({
      path: "/media/usb",
      kind: StorageKind.REMOVABLE,
      available: false,
    });
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [media, used, readThrough, gone, dataDir] }),
    );

    const wrapper = await mountPage();

    const offered = (location: StorageLocation) =>
      row(wrapper, location)
        .find('[data-testid="storage-use-as-source"]')
        .exists();
    expect(offered(media)).toBe(true);
    expect(offered(used)).toBe(false);
    expect(offered(readThrough)).toBe(false);
    expect(offered(gone)).toBe(false);
    expect(offered(dataDir)).toBe(false);
  });

  it("sets up a Local files source on the folder of the location", async () => {
    const wrapper = await mountPage();

    await row(wrapper, share)
      .get('[data-testid="storage-use-as-source"]')
      .trigger("click");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "provider",
      domain: "filesystem_local",
      initialValues: { path: "/media/nas_music" },
      onFlowEnded: expect.any(Function),
    });
  });

  it("fetches the storage again once the source is set up", async () => {
    const wrapper = await mountPage();
    await row(wrapper, share)
      .get('[data-testid="storage-use-as-source"]')
      .trigger("click");
    const { onFlowEnded } = eventbusMock.emit.mock.calls[0]![1];

    onFlowEnded(false);
    await flushPromises();
    expect(apiMock.getStorageInfo).toHaveBeenCalledTimes(1);

    onFlowEnded(true);
    await flushPromises();
    expect(apiMock.getStorageInfo).toHaveBeenCalledTimes(2);
  });

  it("offers a share that was just added as a music source, if no source reads it", async () => {
    const wrapper = await mountPage();
    const addedAction = wrapper
      .findComponent(NetworkShareDialog)
      .props("addedAction")!;

    const action = addedAction(share);
    expect(action?.label).toBe("settings.storage.use_as_source");
    action?.onClick(new MouseEvent("click"));
    expect(eventbusMock.emit).toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.objectContaining({ initialValues: { path: "/media/nas_music" } }),
    );

    // on Home Assistant a Local files source on /media already reads a new share
    expect(addedAction(managedShare({ read_by: ["Local files"] }))).toBe(
      undefined,
    );
  });

  it("tells why any unavailable location is unavailable", async () => {
    const usb = storageLocation({
      path: "/media/usb",
      name: "SANDISK",
      kind: StorageKind.REMOVABLE,
      available: false,
      error: "The drive does not answer.",
    });
    const gone = storageLocation({ ...folder, available: false });
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [usb, gone] }),
    );

    const wrapper = await mountPage();

    expect(row(wrapper, usb).get('[data-testid="storage-error"]').text()).toBe(
      "The drive does not answer.",
    );
    // without a reason the badge says it all
    expect(row(wrapper, gone).text()).toContain("settings.storage.unavailable");
    expect(
      row(wrapper, gone).find('[data-testid="storage-error"]').exists(),
    ).toBe(false);
  });

  it("lists the server's own storage apart from the music locations", async () => {
    const wrapper = await mountPage();

    const music = wrapper.get('[data-testid="storage-music-locations"]');
    const server = wrapper.get('[data-testid="storage-server"]');
    expect(music.text()).not.toContain("/data");
    expect(server.text()).toContain("/data");
    expect(server.text()).toContain("settings.storage.usage.data");
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

describe("StorageSettings while a command runs", () => {
  it("keeps every row waiting and shows the spinner only on the running action", async () => {
    const reload = deferred<typeof share>();
    apiMock.reloadNetworkShare.mockReturnValue(reload.promise);
    const wrapper = await mountPage();

    await row(wrapper, share)
      .get('[data-testid="storage-reload"]')
      .trigger("click");

    expect(actionStates(wrapper)).toEqual({
      [share.path]: [true, true, true],
      [folder.path]: [true],
    });
    expect(spinnersOf(wrapper, share)).toEqual(["storage-reload"]);
    expect(spinnersOf(wrapper, folder)).toEqual([]);
    expect(
      isDisabled(
        row(wrapper, folder).get('[data-testid="storage-use-as-source"]'),
      ),
    ).toBe(true);
    // the page refreshes itself once the command is done
    expect(isDisabled(wrapper.get('[data-testid="storage-refresh"]'))).toBe(
      true,
    );
    // adding does not depend on the running command
    expect(isDisabled(wrapper.get('[data-testid="storage-add-share"]'))).toBe(
      false,
    );

    reload.resolve(share);
    await flushPromises();

    expect(actionStates(wrapper)).toEqual({
      [share.path]: [false, false, false],
      [folder.path]: [false],
    });
    expect(spinnersOf(wrapper, share)).toEqual([]);
  });

  it("lets no second row start a command while one runs", async () => {
    apiMock.reloadNetworkShare.mockReturnValue(
      deferred<typeof share>().promise,
    );
    const wrapper = await mountPage();
    await row(wrapper, share)
      .get('[data-testid="storage-reload"]')
      .trigger("click");

    await row(wrapper, folder)
      .get('[data-testid="storage-remove"]')
      .trigger("click");
    // even a confirmation that got through is turned away
    wrapper.findComponent(RemoveLocationDialog).vm.$emit("confirm", folder);
    await flushPromises();

    expect(wrapper.findComponent(RemoveLocationDialog).props("location")).toBe(
      null,
    );
    expect(apiMock.removeLocalFolder).not.toHaveBeenCalled();
  });

  it("keeps the rows waiting until the refresh after the command is done", async () => {
    const reloaded = deferred<ReturnType<typeof storageInfo>>();
    apiMock.getStorageInfo
      .mockResolvedValueOnce(
        storageInfo({ locations: [media, share, folder, dataDir] }),
      )
      .mockReturnValueOnce(reloaded.promise);
    const wrapper = await mountPage();

    await row(wrapper, share)
      .get('[data-testid="storage-reload"]')
      .trigger("click");
    await flushPromises();

    expect(actionStates(wrapper)[folder.path]).toEqual([true]);

    reloaded.resolve(
      storageInfo({ locations: [media, share, folder, dataDir] }),
    );
    await flushPromises();

    expect(actionStates(wrapper)[folder.path]).toEqual([false]);
  });

  it("keeps the rows waiting while the page refreshes", async () => {
    const refreshed = deferred<ReturnType<typeof storageInfo>>();
    const wrapper = await mountPage();
    apiMock.getStorageInfo.mockReturnValueOnce(refreshed.promise);

    await wrapper.get('[data-testid="storage-refresh"]').trigger("click");

    expect(actionStates(wrapper)).toEqual({
      [share.path]: [true, true, true],
      [folder.path]: [true],
    });
    expect(spinnersOf(wrapper, share)).toEqual([]);

    refreshed.resolve(
      storageInfo({ locations: [media, share, folder, dataDir] }),
    );
    await flushPromises();

    expect(actionStates(wrapper)).toEqual({
      [share.path]: [false, false, false],
      [folder.path]: [false],
    });
  });

  it("frees the rows after a refresh that failed", async () => {
    const wrapper = await mountPage();
    apiMock.getStorageInfo.mockRejectedValueOnce(new Error("connection lost"));

    await wrapper.get('[data-testid="storage-refresh"]').trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(
      "settings.storage.load_failed",
    );
    expect(actionStates(wrapper)).toEqual({
      [share.path]: [false, false, false],
      [folder.path]: [false],
    });
  });

  it("frees the rows after a failed command", async () => {
    const reason = "The NAS did not answer.";
    apiMock.reloadNetworkShare.mockRejectedValue(
      new ApiCommandError(reason, 1, reason),
    );
    const wrapper = await mountPage();

    await row(wrapper, share)
      .get('[data-testid="storage-reload"]')
      .trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(reason);
    expect(apiMock.getStorageInfo).toHaveBeenCalledTimes(2);
    expect(actionStates(wrapper)[share.path]).toEqual([false, false, false]);
  });

  it("frees the rows after a failed refresh", async () => {
    apiMock.getStorageInfo
      .mockResolvedValueOnce(
        storageInfo({ locations: [media, share, folder, dataDir] }),
      )
      .mockRejectedValueOnce(new Error("connection lost"));
    const wrapper = await mountPage();

    await row(wrapper, share)
      .get('[data-testid="storage-reload"]')
      .trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(
      "settings.storage.load_failed",
    );
    expect(actionStates(wrapper)[share.path]).toEqual([false, false, false]);
    expect(isDisabled(wrapper.get('[data-testid="storage-refresh"]'))).toBe(
      false,
    );
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

/** Whether each action of each music location is disabled, by the location's path. */
function actionStates(wrapper: VueWrapper): Record<string, boolean[]> {
  const states: Record<string, boolean[]> = {};
  for (const location of wrapper
    .get('[data-testid="storage-music-locations"]')
    .findAll('[data-testid="storage-location"]')) {
    const buttons = location.findAll(
      '[data-testid="storage-reload"], [data-testid="storage-edit"], [data-testid="storage-remove"]',
    );
    if (buttons.length === 0) continue;
    states[location.attributes("data-path") as string] =
      buttons.map(isDisabled);
  }
  return states;
}

/** The actions of a location that show a spinner. */
function spinnersOf(wrapper: VueWrapper, location: StorageLocation): string[] {
  return row(wrapper, location)
    .findAll("button")
    .filter((button) => button.find('[role="status"]').exists())
    .map((button) => button.attributes("data-testid") ?? "");
}

function isDisabled(element: Omit<DOMWrapper<Element>, "exists">): boolean {
  return element.attributes("disabled") !== undefined;
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
