import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
  },
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

let warnSpy: ReturnType<typeof vi.spyOn>;

/** What the user typed, as the form hands it over. */
const EDITED_VALUES = { server_name: "Living room" };

// the edits the form is holding on to, and whether they validate: a form that
// does not hand its values over is one showing the user what is wrong with them
const hasUnsavedChanges = ref(false);
const valuesValidate = ref(true);

// the form guards its pending edits again when a save does not land
const saveFailed = vi.fn();
// and takes the values that were saved over as its baseline when one does, so
// they stop counting as unsaved
const saveSucceeded = vi.fn((_values: typeof EDITED_VALUES) => {
  hasUnsavedChanges.value = false;
});

/**
 * The form is covered where it lives; here it only has to be reachable, and to
 * answer the step the way the real one does.
 */
const editConfigStub = {
  name: "EditConfig",
  props: ["configEntries", "disabled", "showAdvancedSettings"],
  emits: ["submit"],
  setup(
    _props: unknown,
    { emit }: { emit: (event: "submit", values: typeof EDITED_VALUES) => void },
  ) {
    return {
      hasUnsavedChanges,
      saveFailed,
      saveSucceeded,
      submit: async () => {
        if (valuesValidate.value) emit("submit", EDITED_VALUES);
      },
    };
  },
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
      // in another order than the step asks for them, and one of them advanced
      external_url: entry("external_url", { advanced: true }),
      server_name: entry("server_name"),
      base_url: entry("base_url"),
    },
  };
}

function mountStep() {
  return mount(CoreSettingsStep, {
    global: { stubs: { EditConfig: editConfigStub } },
  });
}

async function mountLoadedStep() {
  const wrapper = mountStep();
  await flushPromises();
  return wrapper;
}

function form(wrapper: ReturnType<typeof mountStep>) {
  return wrapper.findComponent({ name: "EditConfig" });
}

beforeEach(() => {
  vi.clearAllMocks();
  hasUnsavedChanges.value = false;
  valuesValidate.value = true;
  apiMock.getCoreConfig.mockResolvedValue(webserverConfig());
  apiMock.saveCoreConfig.mockResolvedValue(webserverConfig());
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("CoreSettingsStep", () => {
  it("hands the form the webserver settings it is about", async () => {
    const wrapper = await mountLoadedStep();

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

    const wrapper = await mountLoadedStep();

    expect(
      form(wrapper)
        .props("configEntries")
        .map((configEntry: ConfigEntry) => configEntry.key),
    ).toEqual(["server_name"]);

    wrapper.unmount();
  });

  it("keeps the room and says it is busy while the settings load", async () => {
    apiMock.getCoreConfig.mockImplementation(() => new Promise(() => {}));

    const wrapper = await mountLoadedStep();

    expect(wrapper.find("[role=status]").exists()).toBe(true);
    expect(form(wrapper).exists()).toBe(false);
    expect(wrapper.text()).not.toContain(
      "onboarding.steps.core_settings.load_failed",
    );

    wrapper.unmount();
  });

  it("says so when the settings cannot be loaded", async () => {
    apiMock.getCoreConfig.mockRejectedValue(new Error("boom"));

    const wrapper = await mountLoadedStep();

    // the api toasts its own failures; nothing here is filled in with values
    // nobody stands behind
    expect(form(wrapper).exists()).toBe(false);
    expect(wrapper.find("[role=status]").exists()).toBe(false);
    expect(wrapper.text()).toContain(
      "onboarding.steps.core_settings.load_failed",
    );
    expect(warnSpy).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("saves what the form submits, and says so", async () => {
    const wrapper = await mountLoadedStep();

    await form(wrapper).vm.$emit("submit", EDITED_VALUES);
    await flushPromises();

    // the server merges what it is handed in, so a subset is safe to send
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "webserver",
      EDITED_VALUES,
    );
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(saveFailed).not.toHaveBeenCalled();
    // the step stays on screen, so the form is told which values the server
    // now has — and only those
    expect(saveSucceeded).toHaveBeenCalledWith(EDITED_VALUES);

    wrapper.unmount();
  });

  it("has nothing left to save once the form was saved", async () => {
    hasUnsavedChanges.value = true;

    const wrapper = await mountLoadedStep();

    await form(wrapper).vm.$emit("submit", EDITED_VALUES);
    await flushPromises();

    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);

    // moving on after a Save does not send the same settings a second time
    expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
    expect(toastMock.success).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("waits for the save the form's own button started", async () => {
    let landSave: (config: CoreConfig) => void = () => {};
    apiMock.saveCoreConfig.mockImplementation(
      () =>
        new Promise((resolve) => {
          landSave = resolve;
        }),
    );
    hasUnsavedChanges.value = true;

    const wrapper = await mountLoadedStep();
    await form(wrapper).vm.$emit("submit", EDITED_VALUES);

    const leaving = wrapper.vm.beforeLeave();
    landSave(webserverConfig());

    await expect(leaving).resolves.toBe(true);
    // one save, whichever of the two asked for it
    expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("leaves the edits guarded when a save did not land, and says it once", async () => {
    apiMock.saveCoreConfig.mockRejectedValue(new Error("no such address"));

    const wrapper = await mountLoadedStep();

    await form(wrapper).vm.$emit("submit", EDITED_VALUES);
    await flushPromises();

    // the api tells the user itself, so the step does not say it a second time
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(saveFailed).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("waits for the settings before it answers the wizard", async () => {
    let handOverConfig: (config: CoreConfig) => void = () => {};
    apiMock.getCoreConfig.mockImplementation(
      () =>
        new Promise((resolve) => {
          handOverConfig = resolve;
        }),
    );

    const wrapper = mountStep();
    let answered = false;
    const leaving = wrapper.vm.beforeLeave().then((mayLeave) => {
      answered = true;
      return mayLeave;
    });
    await flushPromises();

    // settings the user never saw are not settings they left alone
    expect(answered).toBe(false);

    handOverConfig(webserverConfig());
    await expect(leaving).resolves.toBe(true);

    wrapper.unmount();
  });

  it("lets the wizard move on when there is nothing to save", async () => {
    const wrapper = await mountLoadedStep();

    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);

    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("saves the pending edits before the wizard moves on", async () => {
    hasUnsavedChanges.value = true;

    const wrapper = await mountLoadedStep();

    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "webserver",
      EDITED_VALUES,
    );
    expect(toastMock.success).toHaveBeenCalledWith("settings.settings_saved");

    wrapper.unmount();
  });

  it("keeps the wizard here when the save does not land", async () => {
    hasUnsavedChanges.value = true;
    apiMock.saveCoreConfig.mockRejectedValue(new Error("no such address"));

    const wrapper = await mountLoadedStep();

    await expect(wrapper.vm.beforeLeave()).resolves.toBe(false);

    expect(saveFailed).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("keeps the wizard here when the form has something to say", async () => {
    hasUnsavedChanges.value = true;
    valuesValidate.value = false;

    const wrapper = await mountLoadedStep();

    // the form holds its values back and shows what is wrong with them, so
    // there is nothing to save and nowhere to go
    await expect(wrapper.vm.beforeLeave()).resolves.toBe(false);

    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("lets the wizard move on when there is no form at all", async () => {
    apiMock.getCoreConfig.mockRejectedValue(new Error("boom"));

    const wrapper = await mountLoadedStep();

    // settings that could not be loaded are nothing to hold anyone up over
    await expect(wrapper.vm.beforeLeave()).resolves.toBe(true);

    wrapper.unmount();
  });
});
