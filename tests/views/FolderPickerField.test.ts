import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  type ConfigEntry,
  ConfigEntryType,
  type Scope,
  StorageKind,
  StorageUsage,
} from "@/plugins/api/interfaces";
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
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ resolve: () => ({ href: "#/settings/storage" }) }),
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
    // the media folder is named after its kind, with no badge repeating it
    expect(rows[0].text()).toContain("settings.storage.kind.builtin_media");
    expect(rows[0].findAll("[data-slot='badge']")).toHaveLength(0);
    expect(rows[1].text()).toContain("NAS music");
    expect(rows[1].text()).toContain("settings.storage.kind.network_share");
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

  it("marks the location that holds the selected folder", async () => {
    const wrapper = await mountPicker(folderEntry("/media/Albums/Jazz"));

    const [mediaRow, shareRow] = locationButtons(wrapper);
    expect(
      mediaRow.find('[data-testid="folder-picker-holds-selection"]').exists(),
    ).toBe(true);
    expect(
      shareRow.find('[data-testid="folder-picker-holds-selection"]').exists(),
    ).toBe(false);
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

  it("browses into a location and picks a subfolder by its absolute path", async () => {
    const wrapper = await mountPicker();

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();
    expect(subfolderNames(wrapper)).toEqual(["Albums", "Podcasts"]);

    await subfolderButtons(wrapper)[0].trigger("click");
    await flushPromises();
    expect(apiMock.getStorageFolders).toHaveBeenLastCalledWith("/media/Albums");
    expect(wrapper.text()).toContain("settings.storage.kind.builtin_media");
    expect(subfolderNames(wrapper)).toEqual(["Jazz"]);

    await wrapper.get('[data-testid="folder-picker-use"]').trigger("click");

    expect(wrapper.emitted("update:value")).toEqual([["/media/Albums"]]);
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
  });

  it("marks the folder the entry holds as the one selected", async () => {
    const wrapper = await mountPicker(folderEntry("/media"));

    await locationButtons(wrapper)[0].trigger("click");
    await flushPromises();

    const use = wrapper.get('[data-testid="folder-picker-use"]');
    expect(use.text()).toBe("settings.folder_picker.folder_selected");
    expect(use.attributes("disabled")).toBeDefined();
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
    await subfolderButtons(wrapper)[0].trigger("click");
    await flushPromises();

    const use = wrapper.get('[data-testid="folder-picker-use"]');
    expect(use.text()).toBe("settings.folder_picker.folder_selected");
    expect(use.attributes("disabled")).toBeDefined();
    // the stored value is left exactly as it was
    expect(wrapper.emitted("update:value")).toBeUndefined();
    expect(
      wrapper.get('[data-testid="folder-picker-selection"]').text(),
    ).toContain(stored);
  });

  it("keeps a stored folder outside every location as the selection", async () => {
    const wrapper = await mountPicker(folderEntry("/mnt/legacy/music"));

    expect(
      wrapper.get('[data-testid="folder-picker-selection"]').text(),
    ).toContain("/mnt/legacy/music");
    expect(wrapper.find('[data-testid="folder-picker-outside"]').exists()).toBe(
      true,
    );
    expect(wrapper.emitted("update:value")).toBeUndefined();
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

  it("explains an install without media locations and links to the Storage page", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [dataDir] }),
    );
    const wrapper = await mountPicker();

    const empty = wrapper.get('[data-testid="folder-picker-empty"]');
    expect(empty.text()).toContain("settings.folder_picker.empty_text");
    expect(empty.text()).not.toContain("empty_text_member");
    const manage = wrapper.get('[data-testid="folder-picker-manage"]');
    expect(manage.attributes("href")).toBe("#/settings/storage");
    // the setup dialog it is used from has to stay open
    expect(manage.attributes("target")).toBe("_blank");
  });

  it("sends a user who can not open the Storage page to an administrator", async () => {
    hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ locations: [dataDir] }),
    );
    const wrapper = await mountPicker();

    const empty = wrapper.get('[data-testid="folder-picker-empty"]');
    expect(empty.text()).toContain("settings.folder_picker.empty_text_member");
    expect(wrapper.find('[data-testid="folder-picker-manage"]').exists()).toBe(
      false,
    );
  });

  it("links to the Storage page only for who can change the storage", async () => {
    hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    const wrapper = await mountPicker();

    expect(wrapper.find('[data-testid="folder-picker-manage"]').exists()).toBe(
      false,
    );
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
    await wrapper.get('[data-testid="folder-picker-use"]').trigger("click");

    expect(wrapper.emitted("update:value")).toEqual([["/media/Podcasts"]]);
  });
});

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

async function mountPicker(
  entry: ConfigEntryUI = folderEntry(),
  disabled = false,
): Promise<VueWrapper> {
  const wrapper = mount(FolderPickerField, {
    props: { entry, label: entry.label ?? "", disabled },
    global: { mocks: { $t: translate } },
  });
  await flushPromises();
  return wrapper;
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
