import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, saveFailed, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
  },
  // the form guards its pending edits again when a save does not land
  saveFailed: vi.fn(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

let warnSpy: ReturnType<typeof vi.spyOn>;

/** The form is covered where it lives; here it only has to be reachable. */
const editConfigStub = {
  name: "EditConfig",
  props: ["configEntries", "disabled", "showAdvancedSettings"],
  methods: { saveFailed },
  template: "<div />",
};

function entry(key: string, overrides: Partial<ConfigEntry> = {}): ConfigEntry {
  return {
    category: "generic",
    default_value: null,
    key,
    label: key,
    options: [],
    required: false,
    type: ConfigEntryType.STRING,
    value: `${key} value`,
    ...overrides,
  };
}

/** The webserver configuration, with more in it than this step is about. */
function webserverConfig(values?: Record<string, ConfigEntry>): CoreConfig {
  return {
    domain: "webserver",
    last_error: null,
    values: values ?? {
      bind_port: entry("bind_port"),
      // in another order than the step shows them, and one of them advanced
      external_url: entry("external_url", { advanced: true }),
      server_name: entry("server_name"),
      base_url: entry("base_url"),
    },
  };
}

async function mountStep() {
  const wrapper = shallowMount(CoreSettingsStep, {
    global: { stubs: { EditConfig: editConfigStub } },
  });
  await flushPromises();
  return wrapper;
}

function form(wrapper: Awaited<ReturnType<typeof mountStep>>) {
  return wrapper.findComponent({ name: "EditConfig" });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getCoreConfig.mockResolvedValue(webserverConfig());
  apiMock.saveCoreConfig.mockResolvedValue(webserverConfig());
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("CoreSettingsStep", () => {
  it("shows the webserver settings it is about, in the order it shows them", async () => {
    const wrapper = await mountStep();

    expect(apiMock.getCoreConfig).toHaveBeenCalledWith("webserver");
    expect(
      form(wrapper)
        .props("configEntries")
        .map((configEntry: ConfigEntry) => configEntry.key),
    ).toEqual(["server_name", "base_url", "external_url"]);
    // the three settings are the whole step, so there is nothing to hide
    // behind an advanced toggle it does not offer
    expect(form(wrapper).props("showAdvancedSettings")).toBe(true);

    wrapper.unmount();
  });

  it("leaves out a setting this server does not carry", async () => {
    apiMock.getCoreConfig.mockResolvedValue(
      webserverConfig({ server_name: entry("server_name") }),
    );

    const wrapper = await mountStep();

    expect(
      form(wrapper)
        .props("configEntries")
        .map((configEntry: ConfigEntry) => configEntry.key),
    ).toEqual(["server_name"]);

    wrapper.unmount();
  });

  it("saves what the form submits, and says so", async () => {
    const wrapper = await mountStep();

    await form(wrapper).vm.$emit("submit", {
      server_name: "Living room",
      base_url: "http://192.168.1.2:8095",
      external_url: null,
    });
    await flushPromises();

    // the server merges what it is handed in, so a subset is safe to send
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("webserver", {
      server_name: "Living room",
      base_url: "http://192.168.1.2:8095",
      external_url: null,
    });
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(saveFailed).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("reports a save that did not land and leaves the edits guarded", async () => {
    apiMock.saveCoreConfig.mockRejectedValue(new Error("no such address"));

    const wrapper = await mountStep();

    await form(wrapper).vm.$emit("submit", { server_name: "Living room" });
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("no such address");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(saveFailed).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("shows no form at all when the settings cannot be loaded", async () => {
    apiMock.getCoreConfig.mockRejectedValue(new Error("boom"));

    const wrapper = await mountStep();

    // the api toasts its own failures; nothing here is filled in with values
    // nobody stands behind
    expect(form(wrapper).exists()).toBe(false);
    expect(wrapper.text()).toContain(
      "onboarding.steps.core_settings.description",
    );
    expect(warnSpy).toHaveBeenCalledOnce();

    wrapper.unmount();
  });
});
