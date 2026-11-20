import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import { useSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import { coreOwner } from "@/helpers/settings_pages";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  ProviderType,
  Scope,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../fixtures/providerConfig";

const { apiMock, hasScope, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    invokeCoreConfigAction:
      vi.fn<MusicAssistantApi["invokeCoreConfigAction"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    getProviderConfig: vi.fn<MusicAssistantApi["getProviderConfig"]>(),
    getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
// one menu for the test to read what the form publishes into it
vi.mock("@/composables/useSettingsPageMenu", async () => {
  const { ref } = await import("vue");
  const menu = ref([]);
  return { useSettingsPageMenu: () => menu };
});

enableAutoUnmount(afterEach);

// the form takes the saved values as its baseline, or guards them again
const saveSucceeded = vi.fn();
const saveFailed = vi.fn();
const resetToDefaults = vi.fn();

/**
 * The form is covered where it lives; here it only has to be reachable, and to
 * answer the block the way the real one does.
 */
const editConfigStub = {
  name: "EditConfig",
  props: {
    configEntries: Array,
    disabled: Boolean,
    inlineSave: Boolean,
    hideHeader: Boolean,
    flat: Boolean,
    providerDomain: String,
  },
  emits: ["submit", "action", "immediateApply"],
  setup() {
    return { saveFailed, saveSucceeded, resetToDefaults };
  },
  template: "<div data-testid='edit-config' />",
};

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsPageMenu().value = [];
  hasScope.mockReturnValue(true);
  apiMock.getCoreConfig.mockResolvedValue(streamsConfig());
  apiMock.saveCoreConfig.mockResolvedValue(streamsConfig());
});

describe("SettingsPageForm", () => {
  it("renders nothing for a user who may not change the settings", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const wrapper = await mountForm();

    expect(wrapper.find('[data-testid="settings-page-form"]').exists()).toBe(
      false,
    );
    expect(apiMock.getCoreConfig).not.toHaveBeenCalled();
  });

  it("renders nothing when the page has no settings", async () => {
    apiMock.getCoreConfig.mockResolvedValue({
      ...streamsConfig(),
      values: {},
    });

    const wrapper = await mountForm();

    expect(wrapper.find('[data-testid="settings-page-form"]').exists()).toBe(
      false,
    );
  });

  it("reserves the room for the form while it loads", async () => {
    apiMock.getCoreConfig.mockReturnValue(new Promise(() => {}));

    const wrapper = mount(SettingsPageForm, {
      props: { page: "audio_analysis" },
      global: { stubs: { EditConfig: editConfigStub } },
    });

    expect(wrapper.find(".min-h-24").exists()).toBe(true);
    expect(wrapper.find('[data-testid="edit-config"]').exists()).toBe(false);
  });

  it("says so when the settings could not be loaded", async () => {
    apiMock.getCoreConfig.mockRejectedValue(new Error("offline"));

    const wrapper = await mountForm();

    expect(wrapper.text()).toContain("settings.settings_load_failed");
    expect(wrapper.find('[data-testid="edit-config"]').exists()).toBe(false);
  });

  it("hands the form the settings of the page, with its header", async () => {
    const wrapper = await mountForm();

    const form = wrapper.getComponent(editConfigStub);
    expect(
      (form.props("configEntries") as ConfigEntry[]).map((e) => e.key),
    ).toEqual(["background_scan_concurrency"]);
    expect(form.props("inlineSave")).toBe(true);
    expect(form.props("hideHeader")).toBe(false);
    expect(form.props("flat")).toBe(false);
    expect(form.props("providerDomain")).toBeUndefined();
  });

  it("hands a flat form to a host that frames it", async () => {
    const wrapper = await mountForm({ flat: true });

    const form = wrapper.getComponent(editConfigStub);
    expect(form.props("flat")).toBe(true);
    expect(form.props("inlineSave")).toBe(true);
  });

  it("names the provider to the form of a page showing its settings", async () => {
    const config = providerConfig({
      domain: "hass",
      type: ProviderType.PLUGIN,
      values: {
        power_controls: {
          key: "power_controls",
          category: "player_controls",
          type: ConfigEntryType.STRING,
          multi_value: true,
          label: "power_controls",
          default_value: [],
          required: true,
          options: [],
          value: [],
        },
      },
    });
    // the list of provider configs comes without their entries
    apiMock.getProviderConfigs.mockResolvedValue([{ ...config, values: {} }]);
    apiMock.getProviderConfig.mockResolvedValue(config);

    const wrapper = mount(SettingsPageForm, {
      props: { page: "home_assistant" },
      global: { stubs: { EditConfig: editConfigStub } },
    });
    await flushPromises();

    const form = wrapper.getComponent(editConfigStub);
    expect(form.props("providerDomain")).toBe("hass");
    // the entity pickers match on the keys the provider has
    expect(
      (form.props("configEntries") as ConfigEntry[]).map((e) => e.key),
    ).toEqual(["power_controls"]);
  });

  it("saves the changes and keeps the form on screen", async () => {
    const wrapper = await mountForm();
    const form = wrapper.getComponent(editConfigStub);
    const entries = form.props("configEntries");

    await form.vm.$emit("submit", { background_scan_concurrency: 4 });
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("streams", {
      background_scan_concurrency: 4,
    });
    expect(saveSucceeded).toHaveBeenCalledWith({
      background_scan_concurrency: 4,
    });
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
    expect(wrapper.emitted("saved")).toHaveLength(1);
    // the form captures its baseline once, so it keeps the same entries
    expect(wrapper.getComponent(editConfigStub).props("configEntries")).toBe(
      entries,
    );
  });

  it("guards the edits again when the save did not land", async () => {
    apiMock.saveCoreConfig.mockRejectedValueOnce(new Error("refused"));
    const wrapper = await mountForm();

    await wrapper
      .getComponent(editConfigStub)
      .vm.$emit("submit", { background_scan_concurrency: 4 });
    await flushPromises();

    expect(saveFailed).toHaveBeenCalledOnce();
    expect(saveSucceeded).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(wrapper.emitted("saved")).toBeUndefined();
  });

  it("saves an immediate change on its own, and says so", async () => {
    const wrapper = await mountForm();

    await wrapper
      .getComponent(editConfigStub)
      .vm.$emit("immediateApply", { background_scan_concurrency: 4 });
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("streams", {
      background_scan_concurrency: 4,
    });
    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
      "settings.settings_saved",
    );
    expect(wrapper.emitted("saved")).toHaveLength(1);
  });

  it("confirms no immediate change the server refused", async () => {
    apiMock.saveCoreConfig.mockRejectedValueOnce(new Error("refused"));
    const wrapper = await mountForm();

    await wrapper
      .getComponent(editConfigStub)
      .vm.$emit("immediateApply", { background_scan_concurrency: 4 });
    await flushPromises();

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(wrapper.emitted("saved")).toBeUndefined();
  });

  it("offers a reset of the form in the page menu", async () => {
    await mountForm();

    const [reset] = useSettingsPageMenu().value;
    expect(reset.label).toBe("settings.reset_to_defaults");
    reset.action?.();

    expect(resetToDefaults).toHaveBeenCalledOnce();
  });

  it("offers no reset to a user who may not change the settings", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    await mountForm();

    expect(useSettingsPageMenu().value).toEqual([]);
  });

  it("leaves the page menu to a page the form is a part of", async () => {
    const wrapper = await mountForm({ embedded: true });

    expect(wrapper.find('[data-testid="edit-config"]').exists()).toBe(true);
    expect(useSettingsPageMenu().value).toEqual([]);
  });

  it("keeps what the page it is a part of put in the menu", async () => {
    const pageItem = { label: "settings.reload", action: vi.fn() };
    useSettingsPageMenu().value = [pageItem];

    const wrapper = await mountForm({ embedded: true });
    wrapper.unmount();

    expect(useSettingsPageMenu().value).toEqual([pageItem]);
  });

  it("takes the reset out of the page menu when it closes", async () => {
    const wrapper = await mountForm();

    wrapper.unmount();

    expect(useSettingsPageMenu().value).toEqual([]);
  });
});

describe("SettingsPageForm with settings the page edits itself", () => {
  const WEBSERVER = coreOwner("webserver");
  const customSettings = [
    { owner: WEBSERVER, key: "base_url" },
    { owner: WEBSERVER, key: "external_url" },
  ];
  // shows the keys and values of the entries it is handed, and sets one
  const customSlot = `
    <div data-testid="custom">
      <span v-for="entry in entries" :key="entry.key">{{ entry.key }}={{ entry.value }};</span>
      <button @click="setValue(entries[0].key, 'http://ma.local')" />
    </div>`;

  beforeEach(() => {
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      networkConfig(domain),
    );
  });

  it("hands the page their entries and keeps them out of view in the form", async () => {
    const wrapper = await mountCustom(customSettings);

    expect(wrapper.get('[data-testid="custom"]').text()).toBe(
      "core/webserver/base_url=auto;core/webserver/external_url=;",
    );
    const entries = wrapper
      .getComponent(editConfigStub)
      .props("configEntries") as ConfigEntry[];
    expect(entries.filter((e) => e.hidden).map((e) => e.key)).toEqual([
      "core/webserver/base_url",
      "core/webserver/external_url",
    ]);
  });

  it("sets the value the page edits on the entry the form saves", async () => {
    const wrapper = await mountCustom(customSettings);

    await wrapper.get('[data-testid="custom"] button').trigger("click");

    const entries = wrapper
      .getComponent(editConfigStub)
      .props("configEntries") as ConfigEntry[];
    expect(entries.find((e) => e.key === "core/webserver/base_url")).toEqual(
      expect.objectContaining({ value: "http://ma.local" }),
    );
  });

  it("resets them with the form and tells the page", async () => {
    const wrapper = await mountCustom(customSettings);
    await wrapper.get('[data-testid="custom"] button').trigger("click");

    useSettingsPageMenu().value[0].action?.();

    const entries = wrapper
      .getComponent(editConfigStub)
      .props("configEntries") as ConfigEntry[];
    const baseUrl = entries.find((e) => e.key === "core/webserver/base_url")!;
    expect(baseUrl.value).toBe(baseUrl.default_value);
    expect(resetToDefaults).toHaveBeenCalledOnce();
    expect(wrapper.emitted("reset")).toHaveLength(1);
  });

  it("leaves them in the form when it does not hold every one of them", async () => {
    const wrapper = await mountCustom([
      ...customSettings,
      { owner: WEBSERVER, key: "missing" },
    ]);

    expect(wrapper.find('[data-testid="custom"]').exists()).toBe(false);
    const entries = wrapper
      .getComponent(editConfigStub)
      .props("configEntries") as ConfigEntry[];
    expect(entries.some((e) => e.hidden)).toBe(false);
  });

  async function mountCustom(settings: typeof customSettings) {
    const wrapper = mount(SettingsPageForm, {
      props: { page: "network", customSettings: settings },
      slots: { custom: customSlot },
      global: { stubs: { EditConfig: editConfigStub } },
    });
    await flushPromises();
    return wrapper;
  }
});

async function mountForm(props: { embedded?: boolean; flat?: boolean } = {}) {
  const wrapper = mount(SettingsPageForm, {
    props: { page: "audio_analysis", ...props },
    global: { stubs: { EditConfig: editConfigStub } },
  });
  await flushPromises();
  return wrapper;
}

function streamsConfig(): CoreConfig {
  const entry = (key: string, category: string): ConfigEntry => ({
    key,
    category,
    type: ConfigEntryType.INTEGER,
    label: key,
    default_value: 2,
    required: false,
    options: [],
    value: 2,
  });
  return {
    domain: "streams",
    last_error: null,
    values: {
      bind_port: entry("bind_port", "generic"),
      background_scan_concurrency: entry(
        "background_scan_concurrency",
        "audio_analysis",
      ),
    },
  };
}

function networkConfig(domain: string): CoreConfig {
  const entry = (key: string, value: string): ConfigEntry => ({
    key,
    category: "generic",
    type: ConfigEntryType.STRING,
    label: key,
    default_value: null,
    required: false,
    options: [],
    value,
  });
  const values: Record<string, ConfigEntry[]> = {
    webserver: [entry("base_url", "auto"), entry("external_url", "")],
    streams: [entry("publish_ip", "192.168.1.2")],
    discovery: [],
  };
  return {
    domain,
    last_error: null,
    values: Object.fromEntries(values[domain].map((e) => [e.key, e])),
  };
}
