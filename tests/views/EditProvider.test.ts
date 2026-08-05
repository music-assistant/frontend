import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigEntryType,
  EventType,
  ProviderStage,
  ProviderStatus,
  ProviderType,
  type ProviderConfig,
} from "@/plugins/api/interfaces";
import EditProvider from "@/views/settings/EditProvider.vue";

const { apiMock, eventbusMock, routerMock, toastMock, unsubscribeMock } =
  vi.hoisted(() => ({
    apiMock: {
      getProvider: vi.fn(),
      getProviderConfig: vi.fn(),
      invokeProviderConfigAction: vi.fn(),
      providerManifests: {
        spotify: {
          codeowners: [],
          credits: [],
          description: "Spotify music provider",
          has_setup_flow: true,
          name: "Spotify",
        },
      },
      providers: {},
      reloadProvider: vi.fn(),
      removeProviderConfig: vi.fn(),
      saveProviderConfig: vi.fn(),
      subscribe: vi.fn(),
    },
    eventbusMock: {
      emit: vi.fn(),
    },
    routerMock: {
      push: vi.fn(),
    },
    toastMock: {
      error: vi.fn(),
      success: vi.fn(),
    },
    unsubscribeMock: vi.fn(),
  }));

let providersUpdated: (() => void) | undefined;

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

vi.mock("@/helpers/utils", () => ({
  markdownToHtml: (value: string) => value,
  openActionUrlEntries: <T>(entries: T) => entries,
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
  providersUpdated = undefined;
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.subscribe.mockImplementation(
    (event: EventType, callback: () => void) => {
      if (event === EventType.PROVIDERS_UPDATED) {
        providersUpdated = callback;
      }
      return unsubscribeMock;
    },
  );
});

describe("EditProvider", () => {
  it("refreshes provider state after a provider update", async () => {
    apiMock.getProviderConfig
      .mockResolvedValueOnce(
        providerConfig(ProviderStatus.AUTH_REQUIRED, "current value"),
      )
      .mockResolvedValueOnce(
        providerConfig(ProviderStatus.LOADED, "server refresh"),
      );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("settings.provider_requires_attention");

    providersUpdated?.();
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain(
      "settings.provider_requires_attention",
    );
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("configEntries"),
    ).toEqual([
      expect.objectContaining({
        key: "account",
        value: "current value",
      }),
    ]);

    wrapper.unmount();
    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });

  it("merges fresh entry definitions while keeping a pending local edit", async () => {
    apiMock.getProviderConfig
      .mockResolvedValueOnce(
        providerConfig(ProviderStatus.LOADED, "current value", []),
      )
      .mockResolvedValueOnce(
        providerConfig(ProviderStatus.LOADED, "server refresh", [
          { title: "Home Assistant", value: "ha" },
        ]),
      );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
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
    editConfig.props("configEntries")[0].value = "typed but not saved";

    providersUpdated?.();
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(editConfig.props("configEntries")).toEqual([
      expect.objectContaining({
        key: "account",
        value: "typed but not saved",
        options: [{ title: "Home Assistant", value: "ha" }],
      }),
    ]);
  });

  it("keeps form values when an action returns entries without them", async () => {
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig(ProviderStatus.LOADED, "current value"),
    );
    // an action response carries entry definitions only, never the stored values
    apiMock.invokeProviderConfigAction.mockResolvedValue([
      {
        category: "generic",
        default_value: null,
        key: "account",
        label: "Account",
        required: false,
        type: ConfigEntryType.STRING,
      },
    ]);

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    editConfig.vm.$emit("action", "verify", {}, false);
    await flushPromises();

    expect(editConfig.props("configEntries")).toEqual([
      expect.objectContaining({
        key: "account",
        value: "current value",
      }),
    ]);
  });

  it("refreshes provider status when reconfiguration ends", async () => {
    apiMock.getProviderConfig
      .mockResolvedValueOnce(providerConfig(ProviderStatus.AUTH_REQUIRED))
      .mockResolvedValueOnce(providerConfig(ProviderStatus.LOADED));

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    await wrapper.get("button-stub").trigger("click");

    const setupFlowCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "setupFlowDialog",
    );
    setupFlowCall?.[1].onFlowEnded();
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain(
      "settings.provider_requires_attention",
    );
  });

  it("keeps a pending local edit and shows a toast when an action returns no entries", async () => {
    apiMock.getProviderConfig.mockResolvedValueOnce(
      providerConfig(ProviderStatus.LOADED),
    );
    apiMock.invokeProviderConfigAction.mockResolvedValueOnce([]);

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
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

    expect(apiMock.invokeProviderConfigAction).toHaveBeenCalledWith(
      "spotify--test",
      "do_thing",
    );
    const entriesAfter = editConfig.props("configEntries");
    expect(entriesAfter).toHaveLength(1);
    expect(entriesAfter[0]).toBe(editedEntry);
    expect(entriesAfter[0].value).toBe("typed but not saved");
    expect(apiMock.saveProviderConfig).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith("settings.action_completed");
  });

  it("does not save when an immediate-apply action returns no entries", async () => {
    apiMock.getProviderConfig.mockResolvedValueOnce(
      providerConfig(ProviderStatus.LOADED),
    );
    apiMock.invokeProviderConfigAction.mockResolvedValueOnce([]);

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
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

    expect(apiMock.saveProviderConfig).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith("settings.action_completed");
  });

  it("still replaces the form when an action returns entries (transitional path)", async () => {
    apiMock.getProviderConfig.mockResolvedValueOnce(
      providerConfig(ProviderStatus.LOADED),
    );
    apiMock.invokeProviderConfigAction.mockResolvedValueOnce([
      {
        category: "generic",
        default_value: null,
        key: "new_field",
        label: "New field",
        required: false,
        type: ConfigEntryType.STRING,
        value: "server value",
      },
    ]);

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
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
    expect(apiMock.saveProviderConfig).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

function providerConfig(
  status: ProviderStatus,
  account: string = "current value",
  accountOptions?: { title: string; value: string }[],
): ProviderConfig {
  return {
    domain: "spotify",
    enabled: true,
    instance_id: "spotify--test",
    last_error:
      status === ProviderStatus.AUTH_REQUIRED
        ? {
            error_code: 1,
            message: "Authentication required",
          }
        : undefined,
    manifest: {
      allow_disable: true,
      builtin: false,
      codeowners: [],
      credits: [],
      description: "Spotify music provider",
      domain: "spotify",
      icon_images: [],
      has_setup_flow: true,
      multi_instance: true,
      name: "Spotify",
      requirements: [],
      stage: ProviderStage.STABLE,
      type: ProviderType.MUSIC,
    },
    name: "Spotify",
    status,
    type: ProviderType.MUSIC,
    values: {
      account: {
        category: "generic",
        default_value: null,
        key: "account",
        label: "Account",
        options: accountOptions,
        required: false,
        type: ConfigEntryType.STRING,
        value: account,
      },
    },
  };
}
