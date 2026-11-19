import CoreLogLevelsForm from "@/components/settings/CoreLogLevelsForm.vue";
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
    getCoreConfigs: vi.fn<MusicAssistantApi["getCoreConfigs"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    providerManifests: {} as Record<string, { name: string }>,
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

// the form is covered where it lives
const editConfigStub = {
  name: "EditConfig",
  props: {
    configEntries: Array,
    disabled: Boolean,
    inlineSave: Boolean,
    hideHeader: Boolean,
    showAdvancedSettings: { type: Boolean, default: undefined },
  },
  emits: ["submit"],
  setup() {
    return { saveFailed, saveSucceeded };
  },
  template: "<div data-testid='edit-config' />",
};

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.getCoreConfigs.mockResolvedValue([moduleConfig("streams")]);
  apiMock.saveCoreConfig.mockResolvedValue(moduleConfig("streams", "DEBUG"));
});

describe("CoreLogLevelsForm", () => {
  it("renders nothing for a user who may not change the core settings", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const wrapper = await mountForm();

    expect(wrapper.find('[data-testid="core-log-levels"]').exists()).toBe(
      false,
    );
  });

  it("shows every log level, advanced or not, without the header of the form", async () => {
    const wrapper = await mountForm();

    const form = wrapper.getComponent(editConfigStub);
    expect(
      (form.props("configEntries") as ConfigEntry[]).map((e) => e.key),
    ).toEqual(["core/streams/log_level"]);
    expect(form.props("hideHeader")).toBe(true);
    expect(form.props("showAdvancedSettings")).toBe(true);
    expect(form.props("inlineSave")).toBe(true);
  });

  it("saves a change and keeps the form on screen", async () => {
    const wrapper = await mountForm();

    const values = { "core/streams/log_level": "DEBUG" };
    await wrapper.getComponent(editConfigStub).vm.$emit("submit", values);
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("streams", {
      log_level: "DEBUG",
    });
    expect(saveSucceeded).toHaveBeenCalledWith(values);
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
  });

  it("guards the edits again when the save did not land", async () => {
    apiMock.saveCoreConfig.mockRejectedValueOnce(new Error("refused"));
    const wrapper = await mountForm();

    await wrapper
      .getComponent(editConfigStub)
      .vm.$emit("submit", { "core/streams/log_level": "DEBUG" });
    await flushPromises();

    expect(saveFailed).toHaveBeenCalledOnce();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

async function mountForm() {
  const wrapper = mount(CoreLogLevelsForm, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { EditConfig: editConfigStub },
    },
  });
  await flushPromises();
  return wrapper;
}

function moduleConfig(domain: string, logLevel = "GLOBAL"): CoreConfig {
  return {
    domain,
    last_error: null,
    values: {
      log_level: {
        key: "log_level",
        category: "generic",
        type: ConfigEntryType.STRING,
        label: "Log level",
        default_value: "GLOBAL",
        required: false,
        options: [],
        advanced: true,
        value: logLevel,
      },
    },
  };
}
