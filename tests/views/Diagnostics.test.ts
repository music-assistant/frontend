import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import {
  flushPromises,
  mount,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import { Switch } from "@/components/ui/switch";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  type ConfigEntry,
  type ConfigValueType,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import Diagnostics from "@/views/settings/Diagnostics.vue";
import { nextTick } from "vue";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    sendCommand: vi.fn<MusicAssistantApi["sendCommand"]>(),
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    getCoreConfigs: vi.fn<MusicAssistantApi["getCoreConfigs"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    providerManifests: {} as Record<string, { name: string }>,
  },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: () => true } }));
// a text with arguments shows them, so a test can tell what it names
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}:${args.join("|")}` : key,
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const SAVE_BAR = '[data-testid="settings-save-bar"]';
const SAVE = '[data-testid="config-save"]';
// the core modules the server reports, a few of them
const MODULES = ["streams", "cache", "statistics"];

const LOG_TEXT = "server started";

function mountView() {
  return shallowMount(Diagnostics, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      // the auto-refresh switch sits in a card's slot, so the stubs have to
      // render theirs for it to be reachable
      renderStubDefaultSlot: true,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.sendCommand.mockResolvedValue(LOG_TEXT as never);
  // flushPromises() resolves on setImmediate, so that one has to stay real.
  // The refresh interval and the log view's scroll timeout are what these
  // tests drive.
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Diagnostics log refresh", () => {
  it("refreshes the log every five seconds until the page is closed", async () => {
    const wrapper = mountView();
    await flushPromises();

    // auto-refresh starts switched on, so mounting takes the branch that arms
    // the interval; if that default ever changes this is what fails first
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("arms no refresh interval when the page is closed while the first log fetch is in flight", async () => {
    let deliverLog: (text: string) => void = () => {};
    apiMock.sendCommand.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        deliverLog = resolve;
      }) as never,
    );
    const wrapper = mountView();

    wrapper.unmount();
    deliverLog(LOG_TEXT);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(15_000);

    // a leaked interval keeps pulling the log down for the rest of the session
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    // an interval survives being advanced past, so a count of zero is what
    // rules one out
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs a single refresh interval when auto-refresh is toggled off and on during the first log fetch", async () => {
    let deliverLog: (text: string) => void = () => {};
    apiMock.sendCommand.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        deliverLog = resolve;
      }) as never,
    );
    const wrapper = mountView();

    // switching back on arms an interval from the watcher, which the fetch
    // finishing then finds already in place
    const autoRefreshSwitch = wrapper.findComponent(Switch);
    await autoRefreshSwitch.setValue(false);
    await autoRefreshSwitch.setValue(true);

    deliverLog(LOG_TEXT);
    await flushPromises();
    // only the fetch the page opened with; nothing has been advanced yet
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(15_000);

    // a second interval would outlive the page, since only one handle is closed
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Diagnostics settings", () => {
  it("heads the page with the header of the diagnostics", () => {
    const wrapper = mountView();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "diagnostics",
    );
    wrapper.unmount();
  });

  it("holds the log levels and the cache settings in one form below the log", async () => {
    const wrapper = mountView();
    await flushPromises();

    // the log viewer is what the page is about, so the page menu stays its own;
    // the form saves through the save bar of the page
    expect(wrapper.findAllComponents(SettingsPageForm)).toHaveLength(1);
    expect(wrapper.getComponent(SettingsPageForm).props()).toMatchObject({
      page: "diagnostics",
      embedded: true,
      inlineSave: false,
    });
    wrapper.unmount();
  });
});

describe("Diagnostics saving its settings", () => {
  beforeEach(() => {
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      moduleConfig(domain),
    );
    apiMock.getCoreConfigs.mockImplementation(async () =>
      MODULES.map((domain) => moduleConfig(domain)),
    );
    apiMock.saveCoreConfig.mockImplementation(async (domain, values) =>
      moduleConfig(domain, values),
    );
  });

  it("shows every log level without the advanced settings, and no Save until something changed", async () => {
    const wrapper = await mountSettings();

    expect(rowKeys(wrapper)).toEqual([
      "core/cache/log_level",
      "core/statistics/log_level",
      "core/streams/log_level",
      "core/cache/clear_cache",
      "core/cache/expire_after",
    ]);
    expect(
      wrapper.find('[data-testid="config-advanced-settings"]').exists(),
    ).toBe(false);
    expect(wrapper.find(SAVE).exists()).toBe(false);
    wrapper.unmount();
  });

  it("guards a changed log level as an unsaved change", async () => {
    const wrapper = await mountSettings();

    editRow(wrapper, "core/streams/log_level", "DEBUG");
    await nextTick();

    expect(wrapper.findAll(SAVE_BAR)).toHaveLength(1);
    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

  it("saves a log level and another setting with one Save", async () => {
    const wrapper = await mountSettings();

    editRow(wrapper, "core/streams/log_level", "DEBUG");
    editRow(wrapper, "core/cache/expire_after", 60);
    await nextTick();
    const saves = wrapper.findAll(SAVE);
    expect(saves).toHaveLength(1);
    await saves[0].trigger("click");
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledTimes(2);
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "streams",
      { log_level: "DEBUG" },
      expect.anything(),
    );
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "cache",
      { expire_after: 60 },
      expect.anything(),
    );
    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
      "settings.settings_saved",
    );
    expect(wrapper.find(SAVE_BAR).exists()).toBe(false);
    wrapper.unmount();
  });

  it("keeps the changes a module did not store, names it, and saves them again", async () => {
    apiMock.saveCoreConfig.mockImplementationOnce(async () => {
      throw new Error("refused");
    });
    const wrapper = await mountSettings();

    editRow(wrapper, "core/streams/log_level", "DEBUG");
    editRow(wrapper, "core/cache/expire_after", 60);
    await nextTick();
    await wrapper.get(SAVE).trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(
      "settings.settings_save_failed_for:streams",
      { description: "refused" },
    );
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(rowValue(wrapper, "core/streams/log_level")).toBe("DEBUG");
    expect(wrapper.find(SAVE_BAR).exists()).toBe(true);

    apiMock.saveCoreConfig.mockClear();
    await wrapper.get(SAVE).trigger("click");
    await flushPromises();

    // the cache stored its change the first time
    expect(apiMock.saveCoreConfig).toHaveBeenCalledExactlyOnceWith(
      "streams",
      { log_level: "DEBUG" },
      expect.anything(),
    );
    expect(wrapper.find(SAVE_BAR).exists()).toBe(false);
    wrapper.unmount();
  });

  it("takes what the other modules stored as saved when one module failed", async () => {
    apiMock.saveCoreConfig.mockImplementationOnce(async () => {
      throw new Error("refused");
    });
    const wrapper = await mountSettings();
    editRow(wrapper, "core/streams/log_level", "DEBUG");
    editRow(wrapper, "core/cache/expire_after", 60);
    await nextTick();
    await wrapper.get(SAVE).trigger("click");
    await flushPromises();

    // the change that did not land is undone, and the stored one is no change
    editRow(wrapper, "core/streams/log_level", "GLOBAL");
    await nextTick();

    expect(wrapper.find(SAVE_BAR).exists()).toBe(false);
    wrapper.unmount();
  });

  async function mountSettings() {
    const wrapper = mount(Diagnostics, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          ConfigEntryRow: true,
          ProtocolConfigSection: true,
          SettingsPageHeader: true,
          UnsupportedInstallBanner: true,
        },
      },
    });
    await flushPromises();
    return wrapper;
  }

  function rows(wrapper: VueWrapper) {
    return wrapper.findAllComponents({ name: "ConfigEntryRow" });
  }

  function rowKeys(wrapper: VueWrapper) {
    return rows(wrapper).map((r) => (r.props("confEntry") as ConfigEntry).key);
  }

  function rowValue(wrapper: VueWrapper, key: string) {
    return rows(wrapper)
      .map((r) => r.props("confEntry") as ConfigEntry)
      .find((entry) => entry.key === key)?.value;
  }

  // what typing into the field of an entry does
  function editRow(wrapper: VueWrapper, key: string, value: ConfigValueType) {
    const row = rows(wrapper).find(
      (r) => (r.props("confEntry") as ConfigEntry).key === key,
    );
    if (!row) throw new Error(`no row for ${key}`);
    row.vm.$emit("update:value", value);
  }
});

// a core module as the server sends it: its log level, and the settings of the
// cache module, with a setting holding a value next to its action
function moduleConfig(
  domain: string,
  overrides: Record<string, ConfigValueType> = {},
): CoreConfig {
  const entry = (
    key: string,
    type: ConfigEntryType,
    value: ConfigValueType,
  ): ConfigEntry => ({
    key,
    category: "generic",
    type,
    label: key,
    default_value: value,
    required: false,
    options: [],
    value: key in overrides ? overrides[key] : value,
  });
  const entries: ConfigEntry[] = [
    {
      ...entry("log_level", ConfigEntryType.STRING, "GLOBAL"),
      advanced: true,
    },
  ];
  if (domain === "cache") {
    entries.unshift(
      entry("clear_cache", ConfigEntryType.ACTION, null),
      entry("expire_after", ConfigEntryType.INTEGER, 30),
    );
  }
  return {
    domain,
    last_error: null,
    values: Object.fromEntries(entries.map((e) => [e.key, e])),
  };
}
