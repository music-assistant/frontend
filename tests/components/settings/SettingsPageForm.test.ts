import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  Scope,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, hasScope, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    invokeCoreConfigAction:
      vi.fn<MusicAssistantApi["invokeCoreConfigAction"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

enableAutoUnmount(afterEach);

// the form takes the saved values as its baseline, or guards them again
const saveSucceeded = vi.fn();
const saveFailed = vi.fn();

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
  },
  emits: ["submit", "action", "immediateApply"],
  setup() {
    return { saveFailed, saveSucceeded };
  },
  template: "<div data-testid='edit-config' />",
};

beforeEach(() => {
  vi.clearAllMocks();
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
  });

  it("applies an immediate change without a toast", async () => {
    const wrapper = await mountForm();

    await wrapper
      .getComponent(editConfigStub)
      .vm.$emit("immediateApply", { background_scan_concurrency: 4 });
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("streams", {
      background_scan_concurrency: 4,
    });
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

async function mountForm() {
  const wrapper = mount(SettingsPageForm, {
    props: { page: "audio_analysis" },
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
