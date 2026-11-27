import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import {
  ConfigEntryType,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import EditCoreConfig from "@/views/settings/EditCoreConfig.vue";

const { apiMock, routerMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    invokeCoreConfigAction:
      vi.fn<MusicAssistantApi["invokeCoreConfigAction"]>(),
    providerManifests: {
      cache: {
        codeowners: [],
        credits: [],
        description: "Cache controller",
        documentation: undefined as string | undefined,
        has_setup_flow: false,
        name: "Cache",
      },
      radio_tuner: {
        codeowners: [],
        credits: [],
        description: "Radio tuner module",
        documentation: undefined,
        has_setup_flow: false,
        name: "Radio tuner",
      },
    },
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
  },
  routerMock: {
    back: vi.fn(),
    push: vi.fn(),
    // the entry before the page, null on a page opened directly
    options: { history: { state: { back: null as string | null } } },
  },
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/helpers/utils", () => ({
  getExternalLinkUrl: (url?: string | null) => url ?? undefined,
  openActionUrlEntries: <T>(entries: T) => entries,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: () => routerMock,
  };
});

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  routerMock.options.history.state.back = null;
});

describe("EditCoreConfig", () => {
  it("keeps a pending local edit, shows a toast and clears loading when an action returns no entries", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(coreConfig());
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce([]);

    const wrapper = shallowMount(EditCoreConfig, {
      props: {
        domain: "cache",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    // EditConfig edits the entry objects in place, so this is what a user
    // typing into the form leaves behind
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    const editedEntry = editConfig.props("configEntries")[0];
    editedEntry.value = "typed but not saved";

    await editConfig.vm.$emit("action", "do_thing", {}, false);
    await flushPromises();

    expect(apiMock.invokeCoreConfigAction).toHaveBeenCalledWith(
      "cache",
      "do_thing",
    );
    const entriesAfter = editConfig.props("configEntries");
    expect(entriesAfter).toHaveLength(1);
    expect(entriesAfter[0]).toBe(editedEntry);
    expect(entriesAfter[0].value).toBe("typed but not saved");
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith("settings.action_completed");
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(
      false,
    );
  });

  it.each(["https://music-assistant.io/settings/core/#cache", undefined])(
    "links the documentation the manifest names: %s",
    async (documentation) => {
      apiMock.getCoreConfig.mockResolvedValueOnce(coreConfig());
      apiMock.providerManifests.cache.documentation = documentation;

      const wrapper = shallowMount(EditCoreConfig, {
        props: {
          domain: "cache",
        },
        global: {
          mocks: {
            $t: (key: string) => key,
          },
        },
      });
      await flushPromises();

      expect(
        wrapper
          .findComponent({ name: "SettingsHeaderCard" })
          .props("documentationUrl"),
      ).toBe(documentation);
    },
  );

  it("resets the form to its defaults from the header menu", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(coreConfig());
    const resetToDefaults = vi.fn();

    const wrapper = shallowMount(EditCoreConfig, {
      props: {
        domain: "cache",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          EditConfig: {
            name: "EditConfig",
            methods: { resetToDefaults },
            template: "<div />",
          },
        },
      },
    });
    await flushPromises();

    await wrapper
      .findComponent({ name: "SettingsHeaderCard" })
      .vm.$emit("resetToDefaults");

    expect(resetToDefaults).toHaveBeenCalled();
  });

  it("takes the value an action did provide", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(coreConfig());
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce([
      {
        category: "generic",
        default_value: null,
        key: "new_field",
        label: "New field",
        options: [],
        required: false,
        type: ConfigEntryType.STRING,
        value: "server value",
      },
    ]);

    const wrapper = shallowMount(EditCoreConfig, {
      props: {
        domain: "cache",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    const editConfig = wrapper.findComponent({ name: "EditConfig" });

    await editConfig.vm.$emit("action", "do_thing", {}, false);
    await flushPromises();

    expect(editConfig.props("configEntries")).toEqual([
      expect.objectContaining({
        key: "new_field",
        value: "server value",
      }),
    ]);
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("keeps the current value for an entry the action returned without one", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(coreConfig());
    // an action response carries entry definitions only, never the stored values
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce([
      {
        category: "generic",
        default_value: false,
        key: "clear_on_start",
        label: "Clear cache on start",
        options: [],
        required: false,
        type: ConfigEntryType.BOOLEAN,
      },
    ]);

    const wrapper = shallowMount(EditCoreConfig, {
      props: {
        domain: "cache",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    const editConfig = wrapper.findComponent({ name: "EditConfig" });

    await editConfig.vm.$emit("action", "verify_ssl", {}, false);
    await flushPromises();

    expect(editConfig.props("configEntries")).toEqual([
      expect.objectContaining({
        key: "clear_on_start",
        value: "current value",
      }),
    ]);
  });

  it("keeps the other changes when one applies at once", async () => {
    const config = coreConfig();
    config.values.log_level = {
      ...config.values.clear_on_start,
      key: "log_level",
      type: ConfigEntryType.STRING,
      immediate_apply: true,
      value: "info",
    };
    apiMock.getCoreConfig.mockResolvedValueOnce(structuredClone(config));
    apiMock.saveCoreConfig.mockResolvedValueOnce({
      ...structuredClone(config),
      values: {
        ...structuredClone(config.values),
        log_level: { ...config.values.log_level, value: "debug" },
      },
    });
    const wrapper = shallowMount(EditCoreConfig, {
      props: { domain: "cache" },
      global: { mocks: { $t: (key: string) => key } },
    });
    await flushPromises();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    const formEntry = (key: string) =>
      (editConfig.props("configEntries") as ConfigEntry[]).find(
        (entry) => entry.key === key,
      )!;
    formEntry("clear_on_start").value = "a draft";
    formEntry("log_level").value = "debug";

    editConfig.vm.$emit("immediateApply", { log_level: "debug" });
    await flushPromises();

    expect(formEntry("clear_on_start").value).toBe("a draft");
    expect(formEntry("log_level").value).toBe("debug");
  });

  it("saves the kept values, not the empty ones, on an immediate_apply action", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(coreConfig());
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce([
      {
        category: "generic",
        default_value: false,
        key: "clear_on_start",
        label: "Clear cache on start",
        options: [],
        required: false,
        type: ConfigEntryType.BOOLEAN,
        value: null,
      },
    ]);
    apiMock.saveCoreConfig.mockResolvedValueOnce({
      ...coreConfig(),
      values: {},
    });

    const wrapper = shallowMount(EditCoreConfig, {
      props: {
        domain: "cache",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    const editConfig = wrapper.findComponent({ name: "EditConfig" });

    await editConfig.vm.$emit("action", "do_thing", {}, true);
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("cache", {
      clear_on_start: "current value",
    });
  });

  it("leaves the log level to Diagnostics, while saving it as it is", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(radioTunerConfig());
    apiMock.saveCoreConfig.mockResolvedValueOnce(radioTunerConfig());

    const wrapper = mountWithForm("radio_tuner");
    await flushPromises();

    expect(renderedKeys(wrapper)).toEqual(["band"]);

    await wrapper.find('[data-testid="config-save"]').trigger("click");
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("radio_tuner", {
      band: "band value",
      log_level: "log_level value",
    });
  });

  it("returns to where the user came from after a save", async () => {
    routerMock.options.history.state.back = "/settings/system";
    apiMock.getCoreConfig.mockResolvedValueOnce(radioTunerConfig());
    apiMock.saveCoreConfig.mockResolvedValueOnce(radioTunerConfig());

    const wrapper = mountWithForm("radio_tuner");
    await flushPromises();
    await wrapper.find('[data-testid="config-save"]').trigger("click");
    await flushPromises();

    expect(routerMock.back).toHaveBeenCalledOnce();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("returns to the System settings after a save to a page opened directly", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(radioTunerConfig());
    apiMock.saveCoreConfig.mockResolvedValueOnce(radioTunerConfig());

    const wrapper = mountWithForm("radio_tuner");
    await flushPromises();
    await wrapper.find('[data-testid="config-save"]').trigger("click");
    await flushPromises();

    expect(routerMock.push).toHaveBeenCalledWith({ name: "systemsettings" });
  });

  it("stays on the page when the server refuses the save", async () => {
    const reason = "The value for Band is not valid.";
    apiMock.getCoreConfig.mockResolvedValueOnce(radioTunerConfig());
    apiMock.saveCoreConfig.mockRejectedValueOnce(
      new ApiCommandError(reason, 1, reason),
    );

    const wrapper = mountWithForm("radio_tuner");
    await flushPromises();
    await wrapper.find('[data-testid="config-save"]').trigger("click");
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
    expect(routerMock.push).not.toHaveBeenCalled();
    // the api toasts a refused save itself
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("names the module by its manifest when the app has no name for it", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(radioTunerConfig());

    const wrapper = mountWithForm("radio_tuner");
    await flushPromises();

    expect(
      wrapper.findComponent({ name: "SettingsHeaderCard" }).props("title"),
    ).toBe("Radio tuner");
  });

  it("starts with nothing unsaved on the page of another module", async () => {
    apiMock.getCoreConfig
      .mockResolvedValueOnce(coreConfig())
      .mockResolvedValueOnce(radioTunerConfig());
    const wrapper = mountWithForm("cache");
    await flushPromises();

    await wrapper.setProps({ domain: "radio_tuner" });
    await flushPromises();

    expect(renderedKeys(wrapper)).toEqual(["band"]);
    expect(
      wrapper
        .findComponent({ name: "SettingsSaveBar" })
        .props("unsavedChanges"),
    ).toBe(false);
  });
});

// with the real form, so what it saves and guards can be read
function mountWithForm(domain: string) {
  return shallowMount(EditCoreConfig, {
    props: { domain },
    global: {
      plugins: [createVuetify({ components, directives })],
      renderStubDefaultSlot: true,
      mocks: { $t: (key: string) => key },
      stubs: {
        EditConfig: false,
        VForm: {
          template: "<form><slot /></form>",
          methods: { validate: async () => ({ valid: true }) },
        },
      },
    },
  });
}

function renderedKeys(wrapper: ReturnType<typeof mountWithForm>) {
  return wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    .map((row) => (row.props("confEntry") as ConfigEntry).key);
}

function stringEntry(key: string, category: string): ConfigEntry {
  return {
    category,
    default_value: null,
    key,
    label: key,
    options: [],
    required: false,
    type: ConfigEntryType.STRING,
    value: `${key} value`,
  };
}

// a module added on the server that no settings page shows
function radioTunerConfig(): CoreConfig {
  return {
    domain: "radio_tuner",
    last_error: null,
    values: {
      band: stringEntry("band", "generic"),
      log_level: stringEntry("log_level", "generic"),
    },
  };
}

function coreConfig(): CoreConfig {
  return {
    domain: "cache",
    last_error: null,
    values: {
      clear_on_start: {
        category: "generic",
        default_value: false,
        key: "clear_on_start",
        label: "Clear cache on start",
        options: [],
        required: false,
        type: ConfigEntryType.BOOLEAN,
        value: "current value",
      },
    },
  };
}
