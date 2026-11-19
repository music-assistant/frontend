import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  type ConfigEntry,
  ConfigEntryType,
  type ConfigValueType,
  type Scope,
  ShareType,
  StorageKind,
  StorageUsage,
} from "@/plugins/api/interfaces";
import FolderPickerBrowser from "@/components/settings/storage/FolderPickerBrowser.vue";
import LocalFolderDialog from "@/components/settings/storage/LocalFolderDialog.vue";
import NetworkShareDialog from "@/components/settings/storage/NetworkShareDialog.vue";
import type { StoragePosition } from "@/helpers/storage";
import ConfigEntryField from "@/views/settings/ConfigEntryField.vue";
import FolderPickerField from "@/views/settings/fields/FolderPickerField.vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import {
  managedShare,
  storageInfo,
  storageLocation,
} from "../fixtures/storage";

const { apiMock, hasScopeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    serverInfo: {
      value: { server_version: "2.11.0", homeassistant_addon: false },
    },
    getStorageInfo: vi.fn<MusicAssistantApi["getStorageInfo"]>(),
    getStorageFolders: vi.fn<MusicAssistantApi["getStorageFolders"]>(),
  },
  hasScopeMock: vi.fn<(scope: Scope) => boolean>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale,
}));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: hasScopeMock } }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const translate = (key: string) => key;

const media = storageLocation();
const offlineShare = managedShare({
  available: false,
  error: "The NAS did not answer.",
});
const dataDir = storageLocation({
  path: "/data",
  name: "Data",
  usage: StorageUsage.DATA,
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.serverInfo.value.homeassistant_addon = false;
  hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  apiMock.getStorageInfo.mockResolvedValue(
    storageInfo({ locations: [media, offlineShare, dataDir] }),
  );
  apiMock.getStorageFolders.mockImplementation(async (path) =>
    path === "/media" ? ["Albums", "Podcasts"] : ["Jazz"],
  );
});

describe("FolderPickerField", () => {
  it("lists the media locations, an unavailable one with its reason", async () => {
    const wrapper = await mountPicker();

    const rows = locationButtons(wrapper);
    expect(rows).toHaveLength(2);
    // the media folder is named after its kind, with no type repeating it
    expect(rows[0].text()).toContain("settings.storage.kind.builtin_media");
    expect(rows[0].findAll("[data-slot='badge']")).toHaveLength(0);
    expect(rows[1].text()).toContain("NAS music");
    // the type is plain text next to the path, the badges are for what needs attention
    expect(rows[1].text()).toContain("settings.storage.kind.network_share");
    expect(
      rows[1].findAll("[data-slot='badge']").map((badge) => badge.text()),
    ).toEqual(["settings.storage.unavailable"]);
    expect(rows[1].text()).toContain("settings.storage.unavailable");
    expect(rows[1].text()).toContain("The NAS did not answer.");
    // the server's own directories are no place for music
    expect(wrapper.text()).not.toContain("/data");
  });

  it("tells why a location that Music Assistant did not add is unavailable", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({
        locations: [
          storageLocation({
            path: "/media/usb",
            name: "SANDISK",
            kind: StorageKind.REMOVABLE,
            available: false,
            error: "The drive does not answer.",
          }),
        ],
      }),
    );
    const wrapper = await mountPicker();

    const [usb] = locationButtons(wrapper);
    expect(usb.text()).toContain("settings.storage.unavailable");
    expect(usb.get('[data-testid="folder-picker-error"]').text()).toBe(
      "The drive does not answer.",
    );
  });

  it("marks a read-only location", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({
        locations: [media, managedShare({ read_only: true })],
      }),
    );
    const wrapper = await mountPicker();

    const [mediaRow, shareRow] = locationButtons(wrapper);
    expect(
      mediaRow.find('[data-testid="folder-picker-read-only"]').exists(),
    ).toBe(false);
    expect(shareRow.get('[data-testid="folder-picker-read-only"]').text()).toBe(
      "settings.storage.read_only",
    );
  });

  it("marks the location that holds the selected folder, with that folder", async () => {
    const wrapper = await mountPicker(folderEntry("/media/Albums/Jazz"));

    const [mediaRow, shareRow] = locationButtons(wrapper);
    expect(exists(mediaRow, "folder-picker-holds-selection")).toBe(true);
    expect(
      mediaRow.get('[data-testid="folder-picker-selected-path"]').text(),
    ).toBe("/media/Albums/Jazz");
    expect(exists(shareRow, "folder-picker-holds-selection")).toBe(false);
    expect(exists(shareRow, "folder-picker-selected-path")).toBe(false);
  });

  // the app loads no CSS reset, so a list keeps its browser markers unless told not to
  it("draws its lists without markers", async () => {
    const wrapper = await mountPicker();
    const lists = () => wrapper.findAll("ul, ol");
    expect(lists().every((list) => list.classes("list-none"))).toBe(true);

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(lists().length).toBeGreaterThan(1);
    expect(lists().every((list) => list.classes("list-none"))).toBe(true);
  });

  it("refuses to open an unavailable location", async () => {
    const wrapper = await mountPicker();

    const offline = locationButtons(wrapper)[1];
    expect(offline.attributes("disabled")).toBeDefined();
    await offline.trigger("click");

    expect(apiMock.getStorageFolders).not.toHaveBeenCalled();
  });

  it("picks each folder it opens, by its absolute path", async () => {
    const wrapper = await mountPicker();

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();
    expect(subfolderNames(wrapper)).toEqual(["Albums", "Podcasts"]);
    expect(chosenFolder(wrapper)).toBe("/media");

    await subfolderButtons(wrapper)[0].trigger("click");
    await flushPromises();
    expect(apiMock.getStorageFolders).toHaveBeenLastCalledWith("/media/Albums");
    expect(wrapper.text()).toContain("settings.storage.kind.builtin_media");
    expect(subfolderNames(wrapper)).toEqual(["Jazz"]);
    expect(chosenFolder(wrapper)).toBe("/media/Albums");

    // what the setup submits is the folder on screen
    expect(wrapper.emitted("update:value")).toEqual([
      ["/media"],
      ["/media/Albums"],
    ]);
  });

  it("goes back to the location root through the breadcrumb", async () => {
    const wrapper = await mountPicker();
    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();
    await subfolderButtons(wrapper)[0].trigger("click");
    await flushPromises();

    const [allLocations, root] = wrapper.findAll(
      '[data-testid="folder-picker-crumb"]',
    );
    await root.trigger("click");
    await flushPromises();

    expect(apiMock.getStorageFolders).toHaveBeenLastCalledWith("/media");
    expect(subfolderNames(wrapper)).toEqual(["Albums", "Podcasts"]);

    await allLocations.trigger("click");

    expect(locationButtons(wrapper)).toHaveLength(2);
    // back at the locations, the folder opened last stays picked
    expect(lastValue(wrapper)).toBe("/media");
  });

  it("opens the location that holds the selected folder on that folder", async () => {
    const wrapper = await mountPicker(folderEntry("/media/Albums"));

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(apiMock.getStorageFolders).toHaveBeenCalledTimes(1);
    expect(apiMock.getStorageFolders).toHaveBeenCalledWith("/media/Albums");
    expect(currentFolder(wrapper)).toBe("Albums");
    expect(wrapper.emitted("update:value")).toBeUndefined();
  });

  it("opens the root of that location when the selected folder is gone", async () => {
    const reason = "The folder does not exist.";
    apiMock.getStorageFolders.mockImplementation(async (path) => {
      if (path === "/media/Gone") throw new ApiCommandError(reason, 1, reason);
      return ["Albums", "Podcasts"];
    });
    const wrapper = await mountPicker(folderEntry("/media/Gone"));

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(reason);
    expect(currentFolder(wrapper)).toBe("settings.storage.kind.builtin_media");
    expect(wrapper.emitted("update:value")).toEqual([["/media"]]);
  });

  it("recognises a stored folder written with a trailing slash", async () => {
    const stored = "/media/Albums/";
    const wrapper = await mountPicker(folderEntry(stored));

    expect(wrapper.find('[data-testid="folder-picker-outside"]').exists()).toBe(
      false,
    );
    expect(
      locationButtons(wrapper)[0]
        .find('[data-testid="folder-picker-holds-selection"]')
        .exists(),
    ).toBe(true);

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(currentFolder(wrapper)).toBe("Albums");
    // the stored value is left exactly as it was
    expect(wrapper.emitted("update:value")).toBeUndefined();
  });

  it("keeps a stored folder outside every location as the selection", async () => {
    const wrapper = await mountPicker(folderEntry("/mnt/legacy/music"));

    expect(
      wrapper.get('[data-testid="folder-picker-outside"]').text(),
    ).toContain("/mnt/legacy/music");
    expect(wrapper.emitted("update:value")).toBeUndefined();

    // opening a folder picks that one instead
    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(wrapper.emitted("update:value")).toEqual([["/media"]]);
    expect(exists(wrapper, "folder-picker-outside")).toBe(false);
  });

  it("stays on the locations when a folder cannot be opened", async () => {
    const reason = "The folder does not exist.";
    apiMock.getStorageFolders.mockRejectedValue(
      new ApiCommandError(reason, 1, reason),
    );
    const wrapper = await mountPicker();

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(reason);
    expect(locationButtons(wrapper)).toHaveLength(2);
  });

  it("offers adding a location under the list where the server allows it", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [media], can_add_local_folder: true }),
    );
    const wrapper = await mountPicker();

    expect(exists(wrapper, "folder-picker-add-share")).toBe(true);
    expect(exists(wrapper, "folder-picker-add-folder")).toBe(true);
    // adding happens in place, the picker never leads away from the dialog it is in
    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("offers adding only what the server can add", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({
        locations: [media],
        can_mount_shares: false,
        supported_share_types: [],
      }),
    );
    const wrapper = await mountPicker();

    expect(exists(wrapper, "folder-picker-add-share")).toBe(false);
    expect(exists(wrapper, "folder-picker-add-folder")).toBe(false);
  });

  it("offers adding a location only to who manages the storage", async () => {
    hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [media], can_add_local_folder: true }),
    );
    const wrapper = await mountPicker();

    expect(exists(wrapper, "folder-picker-add-share")).toBe(false);
    expect(exists(wrapper, "folder-picker-add-folder")).toBe(false);
  });

  it("picks a folder added from the picker once the storage lists it", async () => {
    const added = storageLocation({
      path: "/home/me/Music",
      name: "Music",
      kind: StorageKind.MANUAL,
      managed: true,
    });
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [media], can_add_local_folder: true }),
    );
    const wrapper = await mountPicker();

    await wrapper
      .get('[data-testid="folder-picker-add-folder"]')
      .trigger("click");
    const dialog = wrapper.findComponent(LocalFolderDialog);
    expect(dialog.props("open")).toBe(true);

    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [media, added], can_add_local_folder: true }),
    );
    dialog.vm.$emit("added", added);
    await flushPromises();

    expect(apiMock.getStorageInfo).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("update:value")).toEqual([["/home/me/Music"]]);
    expect(locationButtons(wrapper)).toHaveLength(2);
  });

  it("picks a network share added from the picker, with no other next step", async () => {
    const share = managedShare();
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [media] }),
    );
    const wrapper = await mountPicker();

    await wrapper
      .get('[data-testid="folder-picker-add-share"]')
      .trigger("click");
    const dialog = wrapper.findComponent(NetworkShareDialog);
    expect(dialog.props("open")).toBe(true);
    // the picker is already setting the share up as a music source
    expect(dialog.props("addedAction")).toBeUndefined();
    expect(dialog.props("shareTypes")).toEqual([ShareType.CIFS, ShareType.NFS]);

    dialog.vm.$emit("added", share);
    await flushPromises();

    expect(wrapper.emitted("update:value")).toEqual([["/media/nas_music"]]);
  });

  it("fetches the storage again on refresh", async () => {
    const wrapper = await mountPicker();

    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");
    await flushPromises();

    expect(apiMock.getStorageInfo).toHaveBeenCalledTimes(2);
  });

  it("offers nothing to pick while the entry is disabled", async () => {
    const wrapper = await mountPicker(folderEntry(null), true);

    expect(
      locationButtons(wrapper).map((row) => row.attributes("disabled")),
    ).toEqual(["", ""]);
    expect(
      wrapper
        .get('[data-testid="folder-picker-refresh"]')
        .attributes("disabled"),
    ).toBeDefined();
  });

  // the picker sits inside the setup flow's form, where a default-type button submits it
  it("keeps every button out of the form's submit path", async () => {
    const wrapper = await mountPicker();
    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();

    const types = wrapper.findAll("button").map((el) => el.attributes("type"));
    expect(types.length).toBeGreaterThan(0);
    expect(types.every((type) => type === "button")).toBe(true);
  });

  it("is what a folder entry renders as", async () => {
    const wrapper = mount(ConfigEntryField, {
      props: { confEntry: folderEntry("/media"), showPasswordValues: false },
      global: { plugins: [createVuetify()], mocks: { $t: translate } },
    });
    await flushPromises();

    const picker = wrapper.findComponent(FolderPickerField);
    expect(picker.exists()).toBe(true);
    // no free-text path input
    expect(wrapper.find("input").exists()).toBe(false);

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();
    await subfolderButtons(wrapper)[1].trigger("click");
    await flushPromises();

    expect(wrapper.emitted("update:value")).toEqual([["/media/Podcasts"]]);
  });
});

describe("FolderPickerField without a location to pick from", () => {
  it("lets an administrator add one where the server can", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [dataDir], can_add_local_folder: true }),
    );
    const wrapper = await mountPicker();

    const empty = wrapper.get('[data-testid="folder-picker-empty"]');
    expect(empty.text()).toContain("settings.folder_picker.empty_text_add");
    expect(exists(empty, "folder-picker-add-share")).toBe(true);
    expect(exists(empty, "folder-picker-add-folder")).toBe(true);
    expect(exists(empty, "folder-picker-docs")).toBe(false);
  });

  it("tells an administrator of a container how to map a folder into it", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({
        locations: [dataDir],
        can_mount_shares: false,
        supported_share_types: [],
      }),
    );
    const wrapper = await mountPicker();

    const empty = wrapper.get('[data-testid="folder-picker-empty"]');
    expect(empty.text()).toContain(
      "settings.folder_picker.empty_text_container",
    );
    const docs = empty.get('[data-testid="folder-picker-docs"]');
    expect(docs.attributes("href")).toBe(
      "https://music-assistant.io/installation/#with-docker",
    );
    expect(docs.attributes("target")).toBe("_blank");
    expect(empty.find("button").exists()).toBe(false);
  });

  it("points a Home Assistant app to the shares of Home Assistant instead", async () => {
    apiMock.serverInfo.value.homeassistant_addon = true;
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({
        locations: [dataDir],
        can_mount_shares: false,
        supported_share_types: [],
      }),
    );
    const wrapper = await mountPicker();

    const empty = wrapper.get('[data-testid="folder-picker-empty"]');
    expect(empty.text()).toContain("settings.storage.cannot_mount_ha_text");
    expect(empty.text()).not.toContain(
      "settings.folder_picker.empty_text_container",
    );
    expect(
      empty.get('[data-testid="folder-picker-docs"]').attributes("href"),
    ).toBe("https://music-assistant.io/settings/storage/");
    expect(empty.find("button").exists()).toBe(false);
  });

  it("sends a user who can not add storage to an administrator", async () => {
    hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [dataDir], can_add_local_folder: true }),
    );
    const wrapper = await mountPicker();

    const empty = wrapper.get('[data-testid="folder-picker-empty"]');
    expect(empty.text()).toContain("settings.folder_picker.empty_text_member");
    expect(empty.find("button").exists()).toBe(false);
    expect(exists(empty, "folder-picker-docs")).toBe(false);
  });

  it("picks the location added from it", async () => {
    const added = storageLocation({
      path: "/home/me/Music",
      name: "Music",
      kind: StorageKind.MANUAL,
      managed: true,
    });
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [dataDir], can_add_local_folder: true }),
    );
    const wrapper = await mountPicker();

    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [added, dataDir], can_add_local_folder: true }),
    );
    wrapper.findComponent(LocalFolderDialog).vm.$emit("added", added);
    await flushPromises();

    expect(wrapper.emitted("update:value")).toEqual([["/home/me/Music"]]);
    expect(exists(wrapper, "folder-picker-empty")).toBe(false);
    expect(locationButtons(wrapper)).toHaveLength(1);
  });
});

describe("FolderPickerField while folders load", () => {
  it("applies only the answer to the latest folder request", async () => {
    const wrapper = await openMediaFolder();
    const albums = deferred<string[]>();
    const podcasts = deferred<string[]>();
    apiMock.getStorageFolders.mockImplementation((path) =>
      path === "/media/Albums" ? albums.promise : podcasts.promise,
    );

    navigateTo(wrapper, ["Albums"]);
    navigateTo(wrapper, ["Podcasts"]);
    podcasts.resolve(["Live"]);
    await flushPromises();
    albums.resolve(["Jazz"]);
    await flushPromises();

    expect(currentFolder(wrapper)).toBe("Podcasts");
    expect(subfolderNames(wrapper)).toEqual(["Live"]);
    // the folder whose answer came too late is never picked
    expect(wrapper.emitted("update:value")).toEqual([
      ["/media"],
      ["/media/Podcasts"],
    ]);
  });

  it("stays quiet about a folder the user already left", async () => {
    const wrapper = await openMediaFolder();
    const albums = deferred<string[]>();
    apiMock.getStorageFolders.mockImplementation((path) =>
      path === "/media/Albums" ? albums.promise : Promise.resolve(["Live"]),
    );

    navigateTo(wrapper, ["Albums"]);
    navigateTo(wrapper, ["Podcasts"]);
    await flushPromises();
    albums.reject(new ApiCommandError("Gone", 1, "Gone"));
    await flushPromises();

    expect(toastMock.error).not.toHaveBeenCalled();
    expect(currentFolder(wrapper)).toBe("Podcasts");
  });

  it("holds the browser while the storage is fetched again", async () => {
    const wrapper = await openMediaFolder();
    const fetched = deferred<ReturnType<typeof storageInfo>>();
    apiMock.getStorageInfo.mockReturnValueOnce(fetched.promise);

    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");

    // shown the way the picker shows a folder that is loading
    expect(subfolderButtons(wrapper)).toHaveLength(0);
    const crumbs = wrapper.findAll('[data-testid="folder-picker-crumb"]');
    expect(crumbs.length).toBeGreaterThan(0);
    expect(
      crumbs.every((crumb) => crumb.attributes("disabled") !== undefined),
    ).toBe(true);

    fetched.resolve(storageInfo({ locations: [media, offlineShare, dataDir] }));
    await flushPromises();

    expect(subfolderNames(wrapper)).toEqual(["Albums", "Podcasts"]);
    expect(
      crumbs.every((crumb) => crumb.attributes("disabled") === undefined),
    ).toBe(true);
  });

  it("keeps a folder opened during a refresh instead of reopening the old one", async () => {
    const wrapper = await openMediaFolder();
    const fetched = deferred<ReturnType<typeof storageInfo>>();
    const podcasts = deferred<string[]>();
    const mediaAgain = deferred<string[]>();
    apiMock.getStorageInfo.mockReturnValueOnce(fetched.promise);
    apiMock.getStorageFolders.mockImplementation((path) =>
      path === "/media/Podcasts" ? podcasts.promise : mediaAgain.promise,
    );

    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");
    navigateTo(wrapper, ["Podcasts"]);
    // the refresh ends while the folder the user went to is still on its way
    fetched.resolve(storageInfo({ locations: [media, offlineShare, dataDir] }));
    await flushPromises();
    podcasts.resolve(["Live"]);
    await flushPromises();
    mediaAgain.resolve(["Albums", "Podcasts"]);
    await flushPromises();

    expect(currentFolder(wrapper)).toBe("Podcasts");
    expect(subfolderNames(wrapper)).toEqual(["Live"]);
  });
});

describe("FolderPickerField when a folder is gone", () => {
  const gone = () =>
    Promise.reject(
      new ApiCommandError(
        "The folder does not exist.",
        1,
        "The folder does not exist.",
      ),
    );

  it("goes back to the location root when a refresh finds the open folder gone", async () => {
    const wrapper = await openMediaFolder();
    await subfolderButtons(wrapper)[0].trigger("click");
    await flushPromises();
    expect(currentFolder(wrapper)).toBe("Albums");
    apiMock.getStorageFolders.mockImplementation((path) =>
      path === "/media/Albums" ? gone() : Promise.resolve(["Podcasts"]),
    );

    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");
    await flushPromises();

    expect(currentFolder(wrapper)).toBe("settings.storage.kind.builtin_media");
    expect(subfolderNames(wrapper)).toEqual(["Podcasts"]);
    // the reason tells why the view changed
    expect(toastMock.error).toHaveBeenCalledWith("The folder does not exist.");
    // the root on screen is the folder picked now
    expect(lastValue(wrapper)).toBe("/media");
  });

  it("goes back to the locations when the location root fails as well", async () => {
    const wrapper = await openMediaFolder();
    await subfolderButtons(wrapper)[0].trigger("click");
    await flushPromises();
    apiMock.getStorageFolders.mockImplementation(gone);

    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");
    await flushPromises();

    expect(exists(wrapper, "folder-picker-chosen")).toBe(false);
    expect(locationButtons(wrapper)).toHaveLength(2);
  });

  it("goes back to the locations when the location itself is gone", async () => {
    const wrapper = await openMediaFolder();
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [offlineShare, dataDir] }),
    );

    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");
    await flushPromises();

    expect(exists(wrapper, "folder-picker-chosen")).toBe(false);
    expect(locationButtons(wrapper)).toHaveLength(1);
  });

  it("stays where it was when a folder the user opens fails", async () => {
    const wrapper = await openMediaFolder();
    apiMock.getStorageFolders.mockImplementation(gone);

    await subfolderButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("The folder does not exist.");
    expect(currentFolder(wrapper)).toBe("settings.storage.kind.builtin_media");
    expect(subfolderNames(wrapper)).toEqual(["Albums", "Podcasts"]);
    expect(lastValue(wrapper)).toBe("/media");
  });
});

describe("FolderPickerField when the storage can not be fetched again", () => {
  const away = () =>
    Promise.reject(
      new ApiCommandError("The server is away.", 1, "The server is away."),
    );

  /** Opens the Albums folder of the media location, whose subfolder is Jazz. */
  async function openAlbums() {
    const wrapper = await openMediaFolder();
    await subfolderButtons(wrapper)[0].trigger("click");
    await flushPromises();
    expect(currentFolder(wrapper)).toBe("Albums");
    apiMock.getStorageFolders.mockClear();
    return wrapper;
  }

  it("keeps the folder and its subfolders when a refresh fails", async () => {
    const wrapper = await openAlbums();
    const fetched = deferred<ReturnType<typeof storageInfo>>();
    apiMock.getStorageInfo.mockReturnValueOnce(fetched.promise);
    // with the server away, a folder request would fail as well
    apiMock.getStorageFolders.mockImplementation(away);

    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");
    fetched.reject(
      new ApiCommandError("The server is away.", 1, "The server is away."),
    );
    await flushPromises();

    expect(currentFolder(wrapper)).toBe("Albums");
    expect(subfolderNames(wrapper)).toEqual(["Jazz"]);
    expect(apiMock.getStorageFolders).not.toHaveBeenCalled();
    // the refresh reports its failure once, and nothing else adds to it
    expect(toastMock.error).toHaveBeenCalledTimes(1);
    expect(toastMock.error).toHaveBeenCalledWith("The server is away.");
  });

  it("reopens the folder as before once a refresh succeeds again", async () => {
    const wrapper = await openAlbums();
    apiMock.getStorageInfo.mockImplementationOnce(away);
    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");
    await flushPromises();

    const listed = deferred<string[]>();
    apiMock.getStorageFolders.mockReturnValueOnce(listed.promise);
    await wrapper.get('[data-testid="folder-picker-refresh"]').trigger("click");
    await flushPromises();
    listed.resolve(["Jazz", "Soul"]);
    await flushPromises();

    expect(apiMock.getStorageFolders).toHaveBeenCalledWith("/media/Albums");
    expect(currentFolder(wrapper)).toBe("Albums");
    expect(subfolderNames(wrapper)).toEqual(["Jazz", "Soul"]);
  });
});

/** Mounts the picker and opens the media folder, whose subfolders load at once. */
async function openMediaFolder(): Promise<VueWrapper> {
  const wrapper = await mountPicker();
  await locationButtons(wrapper)[0].trigger("click");
  await flushPromises();
  return wrapper;
}

/**
 * Navigates the open browser to a folder of the media location, the way a click on
 * a subfolder or crumb does, also while the browser would not take the click.
 */
function navigateTo(wrapper: VueWrapper, segments: string[]) {
  const target: StoragePosition = { location: media, segments };
  wrapper.findComponent(FolderPickerBrowser).vm.$emit("navigate", target);
}

function currentFolder(wrapper: VueWrapper) {
  return wrapper.get('[aria-current="location"]').text();
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function folderEntry(value: string | null = null): ConfigEntryUI {
  const entry: ConfigEntry = {
    key: "path",
    type: ConfigEntryType.FOLDER,
    label: "Where is it stored?",
    category: "generic",
    default_value: null,
    required: true,
    options: [],
    value,
  };
  return entry;
}

/** Mounts the picker with its value fed back into the entry, as the setup dialog does. */
async function mountPicker(
  entry: ConfigEntryUI = folderEntry(),
  disabled = false,
): Promise<VueWrapper> {
  const wrapper: VueWrapper = mount(FolderPickerField, {
    props: {
      entry,
      label: entry.label ?? "",
      disabled,
      "onUpdate:value": (value: ConfigValueType) =>
        wrapper.setProps({ entry: { ...entry, value } }),
    },
    global: { mocks: { $t: translate } },
  });
  await flushPromises();
  return wrapper;
}

/** The folder the open browser says it picks. */
function chosenFolder(wrapper: VueWrapper) {
  return wrapper
    .get('[data-testid="folder-picker-chosen"] [data-testid="storage-path"]')
    .text();
}

function lastValue(wrapper: VueWrapper) {
  return wrapper.emitted("update:value")?.at(-1)?.[0];
}

/** Whether a page or a part of it holds the element with this test id. */
function exists(
  wrapper: { find(selector: string): { exists(): boolean } },
  testId: string,
) {
  return wrapper.find(`[data-testid="${testId}"]`).exists();
}

function locationButtons(wrapper: VueWrapper) {
  return wrapper.findAll('[data-testid="folder-picker-location"]');
}

function subfolderButtons(wrapper: VueWrapper) {
  return wrapper.findAll('[data-testid="folder-picker-subfolder"]');
}

function subfolderNames(wrapper: VueWrapper) {
  return subfolderButtons(wrapper).map((button) => button.text());
}
