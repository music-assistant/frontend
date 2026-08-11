import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigEntryType, type CoreConfig } from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
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
        has_setup_flow: false,
        name: "Cache",
      },
    },
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
  },
  routerMock: {
    push: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
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

  it.each([
    { advanced: true, offered: true },
    { advanced: false, offered: false },
  ])(
    "offers the advanced toggle for a config with advanced entries: $advanced",
    async ({ advanced, offered }) => {
      const config = coreConfig();
      config.values.clear_on_start.advanced = advanced;
      apiMock.getCoreConfig.mockResolvedValueOnce(config);

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
          .props("showAdvancedToggle"),
      ).toBe(offered);
    },
  );

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
});

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
