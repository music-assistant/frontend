import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigEntryType,
  EventType,
  ProviderStage,
  ProviderStatus,
  ProviderType,
  type ConfigActionResult,
  type ConfigEntry,
  type ProviderConfig,
} from "@/plugins/api/interfaces";
import EditProvider from "@/views/settings/EditProvider.vue";

const { apiMock, eventbusMock, routerMock, toastMock, unsubscribeMock } =
  vi.hoisted(() => ({
    apiMock: {
      getProvider: vi.fn(),
      getProviderConfig: vi.fn(),
      invokeProviderConfigAction:
        vi.fn<
          (
            instanceId: string,
            action: string,
          ) => Promise<ConfigEntry[] | ConfigActionResult>
        >(),
      providerManifests: {
        spotify: {
          allow_disable: true,
          codeowners: [],
          credits: [],
          description: "Spotify music provider",
          documentation: "https://example.com/spotify",
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

const SlotStub = {
  template: "<div><slot /></div>",
};

const providerDetailsStubs = {
  Badge: SlotStub,
  Card: SlotStub,
  CardContent: SlotStub,
  CardDescription: SlotStub,
  CardHeader: SlotStub,
  DropdownMenu: SlotStub,
  DropdownMenuContent: SlotStub,
  DropdownMenuItem: SlotStub,
  DropdownMenuTrigger: SlotStub,
};

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

vi.mock("@/helpers/utils", () => ({
  getExternalLinkUrl: (url?: string) =>
    url?.startsWith("http://") || url?.startsWith("https://") ? url : undefined,
  markdownToHtml: (value: string) => value,
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
  providersUpdated = undefined;
  apiMock.providerManifests.spotify.allow_disable = true;
  apiMock.providerManifests.spotify.documentation =
    "https://example.com/spotify";
  apiMock.providerManifests.spotify.has_setup_flow = true;
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
  it("shows provider status and direct support actions", async () => {
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig(ProviderStatus.LOADED),
    );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "settings.provider_status_loaded",
    );
    expect(wrapper.get("h2").text()).toBe("Spotify");
    expect(wrapper.find('[data-testid="provider-reconfigure"]').exists()).toBe(
      true,
    );
    expect(
      wrapper.get('[data-testid="provider-documentation"]').attributes(),
    ).toMatchObject({
      href: "https://example.com/spotify",
      rel: "noopener noreferrer",
      target: "_blank",
    });
    expect(
      wrapper.get('[data-testid="provider-known-issues"]').attributes(),
    ).toMatchObject({
      href: "https://github.com/music-assistant/support/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22spotify%22",
      rel: "noopener noreferrer",
      target: "_blank",
    });
  });

  it("hides reconfiguration when the provider has no setup flow", async () => {
    apiMock.providerManifests.spotify.has_setup_flow = false;
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig(ProviderStatus.LOADED),
    );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="provider-reconfigure"]').exists()).toBe(
      false,
    );
  });

  it("hides documentation links with an unsafe URL", async () => {
    apiMock.providerManifests.spotify.documentation = "javascript:alert(1)";
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig(ProviderStatus.LOADED),
    );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    expect(
      wrapper.find('[data-testid="provider-documentation"]').exists(),
    ).toBe(false);
  });

  it("disables the provider from the header menu", async () => {
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig(ProviderStatus.LOADED),
    );
    apiMock.saveProviderConfig.mockResolvedValue(
      providerConfig(
        ProviderStatus.DISABLED,
        "current value",
        undefined,
        false,
      ),
    );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    expect(
      wrapper.get('[data-testid="provider-toggle-enabled"]').text(),
    ).toContain("settings.disable");
    await wrapper
      .get('[data-testid="provider-toggle-enabled"]')
      .trigger("click");
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "spotify",
      { enabled: false },
      "spotify--test",
    );
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "settings.provider_status_disabled",
    );
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(true);
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_saved");
  });

  it("keeps the provider enabled when disabling fails", async () => {
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig(ProviderStatus.LOADED),
    );
    apiMock.saveProviderConfig.mockRejectedValue(new Error("Save failed"));

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    await wrapper
      .get('[data-testid="provider-toggle-enabled"]')
      .trigger("click");
    await flushPromises();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(false);
    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(toastMock.error).toHaveBeenCalledWith("Error: Save failed");
  });

  it("reconciles provider state when enabling fails after being saved", async () => {
    apiMock.getProviderConfig
      .mockResolvedValueOnce(
        providerConfig(
          ProviderStatus.DISABLED,
          "current value",
          undefined,
          false,
        ),
      )
      .mockResolvedValueOnce(providerConfig(ProviderStatus.ERROR));
    apiMock.saveProviderConfig.mockRejectedValue(new Error("Load failed"));

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    expect(
      wrapper.get('[data-testid="provider-toggle-enabled"]').text(),
    ).toContain("settings.enable");
    await wrapper
      .get('[data-testid="provider-toggle-enabled"]')
      .trigger("click");
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(false);
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "settings.provider_status_error",
    );
    expect(wrapper.find('[data-testid="provider-reconfigure"]').exists()).toBe(
      true,
    );
  });

  it("ignores a toggle response after navigating to another provider", async () => {
    let resolveSave: (config: ProviderConfig) => void = () => {};
    apiMock.getProviderConfig
      .mockResolvedValueOnce(providerConfig(ProviderStatus.LOADED))
      .mockResolvedValueOnce(
        providerConfig(
          ProviderStatus.LOADED,
          "other value",
          undefined,
          true,
          "spotify--other",
        ),
      );
    apiMock.saveProviderConfig.mockImplementation(
      () =>
        new Promise<ProviderConfig>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    await wrapper
      .get('[data-testid="provider-toggle-enabled"]')
      .trigger("click");
    await wrapper.setProps({ instanceId: "spotify--other" });
    await flushPromises();

    resolveSave(
      providerConfig(
        ProviderStatus.DISABLED,
        "current value",
        undefined,
        false,
      ),
    );
    await flushPromises();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(false);
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "settings.provider_status_loaded",
    );
  });

  it("hides the header menu while enabled when disabling is not supported", async () => {
    apiMock.providerManifests.spotify.allow_disable = false;
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig(ProviderStatus.LOADED),
    );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="provider-menu"]').exists()).toBe(false);
  });

  it("enables a disabled provider when disabling is not supported", async () => {
    apiMock.providerManifests.spotify.allow_disable = false;
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig(
        ProviderStatus.DISABLED,
        "current value",
        undefined,
        false,
      ),
    );
    apiMock.saveProviderConfig.mockResolvedValue(
      providerConfig(ProviderStatus.LOADED),
    );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="provider-menu"]').exists()).toBe(true);
    await wrapper
      .get('[data-testid="provider-toggle-enabled"]')
      .trigger("click");
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "spotify",
      { enabled: true },
      "spotify--test",
    );
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(false);
  });

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
        options: [],
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
        options: [],
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
  enabled: boolean = true,
  instanceId: string = "spotify--test",
): ProviderConfig {
  return {
    domain: "spotify",
    enabled,
    instance_id: instanceId,
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
        options: accountOptions ?? [],
        required: false,
        type: ConfigEntryType.STRING,
        value: account,
      },
    },
  };
}
