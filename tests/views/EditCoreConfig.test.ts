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
import ServerUrlsCard from "@/views/settings/ServerUrlsCard.vue";

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
      webserver: {
        codeowners: [],
        credits: [],
        description: "Web server",
        documentation: undefined,
        has_setup_flow: false,
        name: "Web server",
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

  it("shows the URL card on the webserver page only", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(coreConfig());

    const wrapper = shallowMount(EditCoreConfig, {
      props: { domain: "cache" },
      global: { mocks: { $t: (key: string) => key } },
    });
    await flushPromises();

    expect(wrapper.findComponent(ServerUrlsCard).exists()).toBe(false);
  });

  it("edits the webserver URLs in their own card and saves them with the form", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(webserverConfig());
    apiMock.saveCoreConfig.mockResolvedValueOnce(webserverConfig());

    const wrapper = mountWithForm("webserver");
    await flushPromises();

    const card = wrapper.findComponent(ServerUrlsCard);
    expect(card.props("baseUrl")).toMatchObject({ key: "base_url" });
    expect(card.props("externalUrl")).toMatchObject({ key: "external_url" });
    // the card shows them, so the form leaves them out
    expect(renderedKeys(wrapper)).toEqual(["server_name"]);
    expect(saveDisabled(wrapper)).toBe(true);

    await card.vm.$emit(
      "update:value",
      "external_url",
      "https://music.example",
    );

    expect(saveDisabled(wrapper)).toBe(false);

    await wrapper.find('[data-testid="config-save"]').trigger("click");
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("webserver", {
      server_name: "My server",
      base_url: "auto",
      external_url: "https://music.example",
    });
  });

  it("stays on the page when the server refuses the save", async () => {
    const reason = "The value for Published IP address is not valid.";
    apiMock.getCoreConfig.mockResolvedValueOnce(webserverConfig());
    apiMock.saveCoreConfig.mockRejectedValueOnce(
      new ApiCommandError(reason, 1, reason),
    );

    const wrapper = mountWithForm("webserver");
    await flushPromises();
    await wrapper
      .findComponent(ServerUrlsCard)
      .vm.$emit("update:value", "external_url", "https://music.example");
    await wrapper.find('[data-testid="config-save"]').trigger("click");
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
    expect(routerMock.push).not.toHaveBeenCalled();
    // the api toasts a refused save itself
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("resets the webserver URLs from the header menu too", async () => {
    apiMock.getCoreConfig.mockResolvedValueOnce(
      webserverConfig({
        base_url: "https://ma.lan",
        external_url: "https://music.example",
      }),
    );

    const reset = vi.fn();
    const wrapper = mountWithForm("webserver", {
      ServerUrlsCard: {
        name: "ServerUrlsCard",
        props: ["baseUrl", "externalUrl"],
        template: "<div />",
        methods: { reset },
      },
    });
    await flushPromises();

    await wrapper
      .findComponent({ name: "SettingsHeaderCard" })
      .vm.$emit("resetToDefaults");

    const card = wrapper.findComponent(ServerUrlsCard);
    expect(card.props("baseUrl").value).toBe("auto");
    expect(card.props("externalUrl")?.value).toBeNull();
    // the card's switches follow the reset values rather than earlier choices
    expect(reset).toHaveBeenCalledOnce();
  });
});

// with the real form, so what it saves and guards can be read
function mountWithForm(domain: string, stubs: Record<string, object> = {}) {
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
        ...stubs,
      },
    },
  });
}

function renderedKeys(wrapper: ReturnType<typeof mountWithForm>) {
  return wrapper
    .findAllComponents({ name: "ConfigEntryRow" })
    .map((row) => (row.props("confEntry") as ConfigEntry).key);
}

function saveDisabled(wrapper: ReturnType<typeof mountWithForm>) {
  return (
    wrapper.find('[data-testid="config-save"]').attributes("disabled") ===
    "true"
  );
}

function webserverConfig(
  values: { base_url?: string; external_url?: string | null } = {},
): CoreConfig {
  const entry = (
    key: string,
    value: string | null,
    default_value: string | null,
  ): ConfigEntry => ({
    category: "generic",
    default_value,
    key,
    label: key,
    options: [],
    required: false,
    type: ConfigEntryType.STRING,
    value,
  });
  return {
    domain: "webserver",
    last_error: null,
    values: {
      server_name: entry("server_name", "My server", ""),
      base_url: entry("base_url", values.base_url ?? "auto", "auto"),
      external_url: entry("external_url", values.external_url ?? null, null),
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
