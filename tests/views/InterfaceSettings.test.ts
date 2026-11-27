import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterfaceSettingsStorage } from "@/composables/useInterfaceSettings";
import { DEVICE_SETTING_KEYS } from "@/constants";
import { BrowserMediaControlsMode } from "@/helpers/device_settings";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  ConfigEntryType,
  Scope,
  UserRole,
  type ConfigEntry,
  type ConfigValueType,
} from "@/plugins/api/interfaces";
import InterfaceSettings from "@/views/profile/InterfaceSettings.vue";

const {
  apiMock,
  storeMock,
  setUserPreferences,
  toastMock,
  pageMenu,
  formMock,
} = vi.hoisted(() => ({
  apiMock: { players: {}, providers: {}, serverInfo: { value: undefined } },
  storeMock: {
    isIngressSession: false,
    roleScopes: {} as Record<string, string[]>,
    currentUser: {
      user_id: "user",
      role: "user" as string,
      preferences: {} as Record<string, unknown>,
    },
  },
  setUserPreferences: vi.fn(() => Promise.resolve(true)),
  toastMock: { success: vi.fn(), error: vi.fn() },
  pageMenu: { value: [] as ContextMenuItem[] },
  formMock: {
    resetToDefaults: vi.fn(),
    saveFailed: vi.fn(),
    saveSucceeded: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreferences,
}));
vi.mock("@/composables/useSettingsPageMenu", () => ({
  useSettingsPageMenu: () => pageMenu,
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const createLocalStorageMock = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  } as Storage;
};

// the form is covered where it lives
const editConfigStub = {
  name: "EditConfig",
  props: {
    configEntries: Array,
    disabled: Boolean,
    inlineSave: Boolean,
    hideHeader: Boolean,
  },
  emits: ["submit", "action", "immediateApply"],
  setup(_: unknown, { expose }: { expose: (exposed: object) => void }) {
    expose(formMock);
  },
  template: "<div />",
};

// the settings build their entries on setup, so a leaked instance would answer
// the next test's submit alongside the fresh one
enableAutoUnmount(afterEach);

type MountedSettings = ReturnType<typeof mountSettings>;

function mountSettings(storage: InterfaceSettingsStorage = "account") {
  return mount(InterfaceSettings, {
    props: { storage },
    global: { stubs: { Spinner: true, EditConfig: editConfigStub } },
  });
}

function entriesOf(wrapper: MountedSettings): ConfigEntry[] {
  return wrapper
    .findComponent({ name: "EditConfig" })
    .props("configEntries") as ConfigEntry[];
}

/** Submits every entry, the way EditConfig's getSaveValues does. */
async function submitAll(
  wrapper: MountedSettings,
  overrides: Record<string, ConfigValueType> = {},
) {
  const values = {
    ...Object.fromEntries(
      entriesOf(wrapper).map((entry) => [entry.key, entry.value]),
    ),
    ...overrides,
  };
  wrapper.findComponent({ name: "EditConfig" }).vm.$emit("submit", values);
  await flushPromises();
  return values;
}

describe("InterfaceSettings", () => {
  it.each([
    ["account", "interface"],
    ["device", "device"],
  ] as const)(
    "heads the settings kept on the %s with the header of their page",
    (storage, page) => {
      const wrapper = mountSettings(storage);

      expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(page);
    },
  );

  let reload: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.isIngressSession = false;
    storeMock.roleScopes = { [UserRole.ADMIN]: [Scope.ALL] };
    storeMock.currentUser.role = UserRole.USER;
    storeMock.currentUser.preferences = {};
    pageMenu.value = [];
    vi.stubGlobal("localStorage", createLocalStorageMock());
    reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    reload.mockRestore();
  });

  it("shows the settings in a form named by the page", () => {
    const form = mountSettings().findComponent({ name: "EditConfig" });

    // the breadcrumb names the page, so the form carries no header of its own
    expect(form.props("hideHeader")).toBe(true);
    // the page pins its Save to a bar at the bottom of the screen
    expect(form.props("inlineSave")).toBe(false);
  });

  it("holds the preferences of the account, which follow the user", () => {
    const keys = entriesOf(mountSettings("account")).map(({ key }) => key);

    expect(keys).toEqual([
      "expert_mode",
      "customize_menu",
      "show_waveform",
      "show_letter_index",
      "audiobook_chapter_progress",
      "volume_slider_mode",
      "volume_haptics",
    ]);
    expect(keys.filter((key) => DEVICE_SETTING_KEYS.has(key))).toEqual([]);
  });

  it("holds the settings of this device, and every one of them", () => {
    const keys = entriesOf(mountSettings("device")).map(({ key }) => key);

    expect(keys).toEqual([
      "enable_browser_controls",
      "force_mobile_layout",
      "mobile_sidebar_side",
      "ha_kiosk_mode",
      "web_player_enabled",
    ]);
    expect(new Set(keys)).toEqual(DEVICE_SETTING_KEYS);
  });

  it("stores a setting of this device on the device, without a reload", async () => {
    const wrapper = mountSettings("device");
    const values = await submitAll(wrapper, { force_mobile_layout: true });

    expect(localStorage.getItem("frontend.settings.force_mobile_layout")).toBe(
      "true",
    );
    expect(setUserPreferences).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(formMock.saveSucceeded).toHaveBeenCalledWith(values);
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
  });

  it("writes nothing and does not reload when a save changes nothing", async () => {
    const wrapper = mountSettings();
    const values = await submitAll(wrapper);

    // an entry left as it was stays as it was on the account
    expect(setUserPreferences).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(formMock.saveSucceeded).toHaveBeenCalledWith(values);
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
  });

  it("reloads the app when a per-user preference actually changes", async () => {
    const wrapper = mountSettings();
    const values = await submitAll(wrapper, { show_letter_index: true });

    expect(setUserPreferences).toHaveBeenCalledWith(
      { show_letter_index: true },
      { suppressGlobalError: true },
    );
    expect(reload).toHaveBeenCalled();
    // the form lets go of its changes first, or the reload would ask about them
    expect(formMock.saveSucceeded).toHaveBeenCalledWith(values);
    expect(formMock.saveSucceeded.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0],
    );
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(true);
  });

  it("stays on the page with the saved values when a save needs no reload", async () => {
    const wrapper = mountSettings();
    const values = await submitAll(wrapper, { volume_slider_mode: "relative" });

    expect(setUserPreferences).toHaveBeenCalledWith(
      { volume_slider_mode: "relative" },
      { suppressGlobalError: true },
    );
    expect(reload).not.toHaveBeenCalled();
    expect(formMock.saveSucceeded).toHaveBeenCalledWith(values);
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(
      false,
    );
  });

  it("writes a preference set back to what it was before an earlier save", async () => {
    const wrapper = mountSettings();
    await submitAll(wrapper, { volume_slider_mode: "relative" });
    await submitAll(wrapper, { volume_slider_mode: "absolute" });

    expect(setUserPreferences).toHaveBeenNthCalledWith(
      2,
      { volume_slider_mode: "absolute" },
      { suppressGlobalError: true },
    );
  });

  it("leaves a derived default off the account when another setting is saved", async () => {
    const wrapper = mountSettings();
    await submitAll(wrapper, { show_letter_index: true });

    // the waveform setting follows the expert mode until it is set; saving
    // the letter index must not write it down as a choice
    expect(setUserPreferences).toHaveBeenCalledTimes(1);
    expect(setUserPreferences).not.toHaveBeenCalledWith(
      expect.objectContaining({ show_waveform: expect.anything() }),
      expect.anything(),
    );
  });

  it("keeps the changes guarded when a save fails", async () => {
    setUserPreferences.mockRejectedValueOnce(new Error("offline"));
    const wrapper = mountSettings();
    await submitAll(wrapper, { show_letter_index: true });

    expect(formMock.saveFailed).toHaveBeenCalled();
    expect(formMock.saveSucceeded).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith("settings.save_failed");
    expect(reload).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(
      false,
    );
  });

  it("keeps a change the server did not take, and writes it again on the next save", async () => {
    setUserPreferences.mockResolvedValueOnce(false);
    const wrapper = mountSettings();
    await submitAll(wrapper, { volume_slider_mode: "relative" });

    expect(formMock.saveFailed).toHaveBeenCalled();
    expect(formMock.saveSucceeded).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith("settings.save_failed");
    expect(toastMock.success).not.toHaveBeenCalled();

    await submitAll(wrapper, { volume_slider_mode: "relative" });

    expect(setUserPreferences).toHaveBeenCalledTimes(2);
    expect(formMock.saveSucceeded).toHaveBeenCalledOnce();
  });

  it.each([
    [UserRole.USER, false],
    [UserRole.ADMIN, true],
  ])(
    "offers the expert mode first, as the %s's default until they choose",
    (role, expert) => {
      storeMock.currentUser.role = role;

      const [entry] = entriesOf(mountSettings());

      expect(entry).toMatchObject({
        key: "expert_mode",
        type: ConfigEntryType.BOOLEAN,
        default_value: expert,
        value: expert,
      });
    },
  );

  it("shows the expert mode the user chose, with their default to reset to", () => {
    storeMock.currentUser.role = UserRole.ADMIN;
    storeMock.currentUser.preferences = { expert_mode: false };

    const [entry] = entriesOf(mountSettings());

    expect(entry).toMatchObject({ value: false, default_value: true });
  });

  it("stores a switched expert mode on the account and reloads", async () => {
    const wrapper = mountSettings();
    await submitAll(wrapper, { expert_mode: true });

    expect(setUserPreferences).toHaveBeenCalledOnce();
    expect(setUserPreferences).toHaveBeenCalledWith(
      { expert_mode: true },
      { suppressGlobalError: true },
    );
    expect(reload).toHaveBeenCalled();
  });

  it("defaults browser media controls to the built-in web player", () => {
    const entry = entriesOf(mountSettings("device")).find(
      ({ key }) => key === "enable_browser_controls",
    );

    expect(entry).toMatchObject({
      type: ConfigEntryType.STRING,
      default_value: BrowserMediaControlsMode.WEB_PLAYER,
      value: BrowserMediaControlsMode.WEB_PLAYER,
    });
    expect(entry?.options.map(({ value }) => value)).toEqual([
      BrowserMediaControlsMode.ACTIVE_PLAYER,
      BrowserMediaControlsMode.WEB_PLAYER,
      BrowserMediaControlsMode.DISABLED,
    ]);
  });

  it.each([
    [false, true],
    [true, false],
  ])(
    "offers the Home Assistant kiosk mode only in an ingress session (ingress: %s)",
    (ingress, hidden) => {
      storeMock.isIngressSession = ingress;

      const entry = entriesOf(mountSettings("device")).find(
        ({ key }) => key === "ha_kiosk_mode",
      );

      expect(entry?.hidden).toBe(hidden);
    },
  );

  it("resets the form from the page's menu while it is on screen", () => {
    const wrapper = mountSettings();

    expect(pageMenu.value.map(({ label }) => label)).toEqual([
      "settings.reset_to_defaults",
    ]);
    pageMenu.value[0].action?.();
    expect(formMock.resetToDefaults).toHaveBeenCalled();

    wrapper.unmount();
    expect(pageMenu.value).toEqual([]);
  });
});
