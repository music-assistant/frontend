import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type Ref } from "vue";
import { provideEditedProviderName } from "@/composables/useEditedProviderName";
import {
  ConfigEntryType,
  EventType,
  ProviderFeature,
  ProviderSharing,
  ProviderStatus,
  ProviderType,
  type ProviderConfig,
  type Scope,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { store } from "@/plugins/store";
import EditProvider from "@/views/settings/EditProvider.vue";
import { providerConfig } from "../fixtures/providerConfig";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const {
  apiMock,
  authMock,
  eventbusMock,
  i18nMock,
  routerMock,
  toastMock,
  unsubscribeMock,
} = vi.hoisted(() => ({
  apiMock: {
    getAllUsers: vi.fn<MusicAssistantApi["getAllUsers"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    getProviderConfig: vi.fn<MusicAssistantApi["getProviderConfig"]>(),
    getShareCandidates: vi.fn<MusicAssistantApi["getShareCandidates"]>(),
    invokeProviderConfigAction:
      vi.fn<MusicAssistantApi["invokeProviderConfigAction"]>(),
    providerManifests: {
      spotify: {
        allow_disable: true,
        builtin: false,
        codeowners: [],
        credits: [],
        description: "Spotify music provider",
        documentation: "https://example.com/spotify",
        has_setup_flow: true,
        name: "Spotify",
        self_service: true,
      },
    },
    providers: {},
    reloadProvider: vi.fn<MusicAssistantApi["reloadProvider"]>(),
    removeProviderConfig: vi.fn<MusicAssistantApi["removeProviderConfig"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
    subscribe: vi.fn(),
  },
  authMock: {
    hasScope: vi.fn<(scope: Scope) => boolean>(),
  },
  eventbusMock: {
    emit: vi.fn(),
  },
  // a spy that returns the key, so the interpolation arguments a message is
  // given stay assertable
  i18nMock: {
    t: vi.fn((key: string) => key),
  },
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
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
  // rendered for real so this screen's advanced toggle stays assertable
  AdvancedSettingsToggle: false,
  Badge: SlotStub,
  Card: SlotStub,
  CardContent: SlotStub,
  CardDescription: SlotStub,
  CardHeader: SlotStub,
};

// the rename dialog's Vuetify shell, rendered where it is declared so the
// dialog can be driven through the template; kept out of the shared stubs
// because a real <button> would shadow the `button-stub` the other tests click
const renameDialogStubs = {
  VBtn: {
    emits: ["click"],
    template:
      '<button type="button" @click="$emit(\'click\')"><slot /></button>',
  },
  VCard: SlotStub,
  VCardActions: SlotStub,
  VCardText: SlotStub,
  VCardTitle: SlotStub,
  VDialog: {
    props: ["modelValue"],
    template: '<div v-if="modelValue"><slot /></div>',
  },
  VTextField: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
};

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: authMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

vi.mock("@/helpers/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/helpers/utils")>();
  return {
    getExternalLinkUrl: (url?: string) =>
      url?.startsWith("http://") || url?.startsWith("https://")
        ? url
        : undefined,
    // the real renderer, so the error banner's markdown is assertable
    markdownToHtml: actual.markdownToHtml,
    openActionUrlEntries: <T>(entries: T) => entries,
  };
});

vi.mock("@/plugins/i18n", () => ({
  $t: i18nMock.t,
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => i18nMock,
  };
});

vi.mock("@/plugins/router", () => ({
  default: routerMock,
}));

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
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  store.currentUser = undefined;
  apiMock.providerManifests.spotify.allow_disable = true;
  apiMock.providerManifests.spotify.documentation =
    "https://example.com/spotify";
  apiMock.providerManifests.spotify.has_setup_flow = true;
  apiMock.providerManifests.spotify.self_service = true;
  apiMock.getAllUsers.mockResolvedValue([]);
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.getShareCandidates.mockResolvedValue([]);
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
      spotifyConfig(ProviderStatus.LOADED),
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

  it("shows the custom name of a source that is not loaded, and hands the settings frame the same one", async () => {
    // not in api.providers: nothing is running to ask for a name, so only the
    // configuration knows this instance is not just "Spotify"
    const config = spotifyConfig(
      ProviderStatus.DISABLED,
      "current value",
      undefined,
      false,
    );
    config.name = "The kitchen's Spotify";
    apiMock.getProviderConfig.mockResolvedValue(config);

    const { wrapper, publishedName } = mountFramedProvider();
    await flushPromises();

    expect(wrapper.get("h2").text()).toBe("The kitchen's Spotify");
    expect(publishedName.value).toBe("The kitchen's Spotify");

    wrapper.unmount();

    // opening another provider next should fall back to that one's own name
    expect(publishedName.value).toBe("");
  });

  it("hides reconfiguration when the provider has no setup flow", async () => {
    apiMock.providerManifests.spotify.has_setup_flow = false;
    apiMock.getProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.LOADED),
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
      spotifyConfig(ProviderStatus.LOADED),
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
      spotifyConfig(ProviderStatus.LOADED),
    );
    apiMock.saveProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.DISABLED, "current value", undefined, false),
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

    (await menuEntry(wrapper, "settings.disable")).action?.();
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
      spotifyConfig(ProviderStatus.LOADED),
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

    (await menuEntry(wrapper, "settings.disable")).action?.();
    await flushPromises();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(false);
    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    // the api toasts a refused save itself
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("reconciles provider state when enabling fails after being saved", async () => {
    apiMock.getProviderConfig
      .mockResolvedValueOnce(
        spotifyConfig(
          ProviderStatus.DISABLED,
          "current value",
          undefined,
          false,
        ),
      )
      .mockResolvedValueOnce(spotifyConfig(ProviderStatus.ERROR));
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

    (await menuEntry(wrapper, "settings.enable")).action?.();
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
      .mockResolvedValueOnce(spotifyConfig(ProviderStatus.LOADED))
      .mockResolvedValueOnce(
        spotifyConfig(
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

    (await menuEntry(wrapper, "settings.disable")).action?.();
    await wrapper.setProps({ instanceId: "spotify--other" });
    await flushPromises();

    resolveSave(
      spotifyConfig(ProviderStatus.DISABLED, "current value", undefined, false),
    );
    await flushPromises();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(false);
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "settings.provider_status_loaded",
    );
  });

  it("ignores a toggle error after navigating to another provider", async () => {
    let rejectSave: (error: Error) => void = () => {};
    apiMock.getProviderConfig
      .mockResolvedValueOnce(spotifyConfig(ProviderStatus.LOADED))
      .mockResolvedValueOnce(
        spotifyConfig(
          ProviderStatus.LOADED,
          "other value",
          undefined,
          true,
          "spotify--other",
        ),
      );
    apiMock.saveProviderConfig.mockImplementation(
      () =>
        new Promise<ProviderConfig>((_resolve, reject) => {
          rejectSave = reject;
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

    (await menuEntry(wrapper, "settings.disable")).action?.();
    await wrapper.setProps({ instanceId: "spotify--other" });
    await flushPromises();

    rejectSave(new Error("Old provider failed"));
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="provider-status"]').text()).toContain(
      "settings.provider_status_loaded",
    );
  });

  it("disables the disable item while enabled when disabling is not supported", async () => {
    apiMock.providerManifests.spotify.allow_disable = false;
    apiMock.getProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.LOADED),
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

    expect((await menuEntry(wrapper, "settings.disable")).disabled).toBe(true);
    expect(
      (await menuEntry(wrapper, "settings.reset_to_defaults")).disabled,
    ).toBe(false);
  });

  it("resets the form to its defaults from the header menu", async () => {
    apiMock.getProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.LOADED),
    );
    const resetToDefaults = vi.fn();

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: {
          ...providerDetailsStubs,
          EditConfig: {
            name: "EditConfig",
            methods: { resetToDefaults },
            template: "<div />",
          },
        },
      },
    });
    await flushPromises();

    (await menuEntry(wrapper, "settings.reset_to_defaults")).action?.();

    expect(resetToDefaults).toHaveBeenCalled();
  });

  it.each([
    { advanced: true, offered: true },
    { advanced: false, offered: false },
  ])(
    "offers the advanced toggle for a config with advanced entries: $advanced",
    async ({ advanced, offered }) => {
      const config = spotifyConfig(ProviderStatus.LOADED);
      config.values.account.advanced = advanced;
      apiMock.getProviderConfig.mockResolvedValue(config);

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
        wrapper.find('[data-testid="provider-advanced-settings"]').exists(),
      ).toBe(offered);
    },
  );

  it("enables a disabled provider when disabling is not supported", async () => {
    apiMock.providerManifests.spotify.allow_disable = false;
    apiMock.getProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.DISABLED, "current value", undefined, false),
    );
    apiMock.saveProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.LOADED),
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

    const enableEntry = await menuEntry(wrapper, "settings.enable");
    expect(enableEntry.disabled).toBe(false);
    enableEntry.action?.();
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
        spotifyConfig(ProviderStatus.AUTH_REQUIRED, "current value"),
      )
      .mockResolvedValueOnce(
        spotifyConfig(ProviderStatus.LOADED, "server refresh"),
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
        spotifyConfig(ProviderStatus.LOADED, "current value", []),
      )
      .mockResolvedValueOnce(
        spotifyConfig(ProviderStatus.LOADED, "server refresh", [
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
      spotifyConfig(ProviderStatus.LOADED, "current value"),
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
      .mockResolvedValueOnce(spotifyConfig(ProviderStatus.AUTH_REQUIRED))
      .mockResolvedValueOnce(spotifyConfig(ProviderStatus.LOADED));

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
    setupFlowCall?.[1].onFlowEnded(true);
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain(
      "settings.provider_requires_attention",
    );
  });

  it("names the source it launches reconfiguration for", async () => {
    apiMock.getProviderConfig.mockResolvedValue({
      ...spotifyConfig(ProviderStatus.AUTH_REQUIRED),
      name: "My Spotify",
    });

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

    expect(eventbusMock.emit).toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.objectContaining({
        kind: "reconfigure",
        instanceId: "spotify--test",
        name: "My Spotify",
      }),
    );
  });

  it("renders a markdown link in the provider error banner", async () => {
    // a retired provider's message points at its replacement, so the link has
    // to survive into the banner
    const config = spotifyConfig(ProviderStatus.INCOMPATIBLE);
    config.last_error = {
      error_code: 1,
      message:
        "This provider is retired. Use the [Local Audio add-on](https://example.com/addon) instead.",
    };
    apiMock.getProviderConfig.mockResolvedValue(config);

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: { ...providerDetailsStubs, MarkdownText: false },
      },
    });
    await flushPromises();

    const link = wrapper.get("a[href='https://example.com/addon']");
    expect(link.text()).toBe("Local Audio add-on");
  });

  it("names the source in the removal confirmation and toast", async () => {
    // a renamed provider must be removed under the name the user gave it, so
    // the custom name has to win over the manifest's "Spotify"
    const config = spotifyConfig(ProviderStatus.INCOMPATIBLE);
    config.name = "My Spotify";
    config.last_error = {
      error_code: 1,
      message: "This provider is retired.",
    };
    apiMock.getProviderConfig.mockResolvedValue(config);
    apiMock.removeProviderConfig.mockResolvedValue(undefined);

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

    // the banner's only button is the destructive "remove" one
    await wrapper.get("button-stub").trigger("click");

    const removeCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "deleteConfirmationDialog",
    );
    expect(removeCall?.[1].message).toBe(
      "settings.remove_provider_confirm_music",
    );
    // the stubbed t returns the key, so the name is checked where it is passed
    expect(i18nMock.t).toHaveBeenCalledWith(
      "settings.remove_provider_confirm_music",
      ["My Spotify"],
    );

    await removeCall?.[1].onConfirm();
    await flushPromises();

    expect(apiMock.removeProviderConfig).toHaveBeenCalledWith("spotify--test");
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_removed");
    expect(i18nMock.t).toHaveBeenCalledWith("settings.provider_removed", [
      "My Spotify",
    ]);
  });

  it("falls back to the default name when the source has no custom name", async () => {
    // an unloaded provider has no instance to read a name from, so the config's
    // default name has to carry it rather than the generic manifest name
    const config = spotifyConfig(ProviderStatus.INCOMPATIBLE);
    config.name = null;
    config.default_name = "Spotify (sam)";
    config.last_error = {
      error_code: 1,
      message: "This provider is retired.",
    };
    apiMock.getProviderConfig.mockResolvedValue(config);
    apiMock.removeProviderConfig.mockResolvedValue(undefined);

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

    await wrapper.get("button-stub").trigger("click");

    expect(i18nMock.t).toHaveBeenCalledWith(
      "settings.remove_provider_confirm_music",
      ["Spotify (sam)"],
    );
  });

  it("saves a new name for the source and confirms it", async () => {
    apiMock.getProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.LOADED),
    );
    // the server decides the stored name - here it deduplicates the one that
    // was typed - so the header has to show its answer, not what was sent
    const savedConfig = spotifyConfig(ProviderStatus.LOADED);
    savedConfig.name = "Kitchen Spotify (2)";
    apiMock.saveProviderConfig.mockResolvedValue(savedConfig);

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: { ...providerDetailsStubs, ...renameDialogStubs },
      },
    });
    await flushPromises();

    // the stubbed $t returns the key, so the pencil's label is the key itself
    await wrapper
      .get('[aria-label="settings.set_custom_name"]')
      .trigger("click");
    await wrapper.get("input").setValue("Kitchen Spotify");
    await wrapper.get('[data-testid="provider-rename-save"]').trigger("click");
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "spotify",
      { name: "Kitchen Spotify" },
      "spotify--test",
    );
    expect(wrapper.get("h2").text()).toBe("Kitchen Spotify (2)");
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_saved");
  });

  it("restores the previous name when renaming fails", async () => {
    const config = spotifyConfig(ProviderStatus.LOADED);
    config.name = "My Spotify";
    apiMock.getProviderConfig.mockResolvedValue(config);
    apiMock.saveProviderConfig.mockRejectedValue(new Error("Rename failed"));

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: { ...providerDetailsStubs, ...renameDialogStubs },
      },
    });
    await flushPromises();

    await wrapper
      .get('[aria-label="settings.set_custom_name"]')
      .trigger("click");
    await wrapper.get("input").setValue("Kitchen Spotify");
    await wrapper.get('[data-testid="provider-rename-save"]').trigger("click");
    await flushPromises();

    expect(wrapper.get("h2").text()).toBe("My Spotify");
    expect(toastMock.error).toHaveBeenCalledWith("Error: Rename failed");
  });

  it("ignores a second submission while a rename is still saving", async () => {
    let resolveSave: (config: ProviderConfig) => void = () => {};
    apiMock.getProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.LOADED),
    );
    // held open so the dialog is still on screen, and submittable, while the
    // first rename is in flight
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
        stubs: { ...providerDetailsStubs, ...renameDialogStubs },
      },
    });
    await flushPromises();

    await wrapper
      .get('[aria-label="settings.set_custom_name"]')
      .trigger("click");
    await wrapper.get("input").setValue("Kitchen Spotify");
    // the button first and the enter key second: the pending save disables the
    // button, so the key press is the entry point a second save could get in by
    await wrapper.get('[data-testid="provider-rename-save"]').trigger("click");
    await wrapper.get("input").trigger("keyup.enter");

    expect(apiMock.saveProviderConfig).toHaveBeenCalledTimes(1);

    const savedConfig = spotifyConfig(ProviderStatus.LOADED);
    savedConfig.name = "Kitchen Spotify";
    resolveSave(savedConfig);
    await flushPromises();

    expect(wrapper.get("h2").text()).toBe("Kitchen Spotify");
    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_saved");
  });

  it("saves a rename from the enter key on the name field", async () => {
    apiMock.getProviderConfig.mockResolvedValue(
      spotifyConfig(ProviderStatus.LOADED),
    );
    const savedConfig = spotifyConfig(ProviderStatus.LOADED);
    savedConfig.name = "Kitchen Spotify";
    apiMock.saveProviderConfig.mockResolvedValue(savedConfig);

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
        stubs: { ...providerDetailsStubs, ...renameDialogStubs },
      },
    });
    await flushPromises();

    await wrapper
      .get('[aria-label="settings.set_custom_name"]')
      .trigger("click");
    await wrapper.get("input").setValue("Kitchen Spotify");
    // no save in flight, so the key press is the only thing that can submit
    await wrapper.get("input").trigger("keyup.enter");
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledTimes(1);
    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "spotify",
      { name: "Kitchen Spotify" },
      "spotify--test",
    );
    expect(wrapper.get("h2").text()).toBe("Kitchen Spotify");
  });

  it("keeps a pending local edit and shows a toast when an action returns no entries", async () => {
    apiMock.getProviderConfig.mockResolvedValueOnce(
      spotifyConfig(ProviderStatus.LOADED),
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
      spotifyConfig(ProviderStatus.LOADED),
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
      spotifyConfig(ProviderStatus.LOADED),
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

  it("sends an admin back to the music sources page after saving", async () => {
    const wrapper = await mountSavedProvider();

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "providersettings",
      query: { types: ProviderType.MUSIC },
    });
    expect(wrapper.findComponent({ name: "EditConfig" }).exists()).toBe(true);
  });

  it("sends a member back to the music sources page after saving", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    store.currentUser = user({ user_id: "member-id" });

    await mountSavedProvider({
      ...spotifyConfig(ProviderStatus.LOADED),
      access: {
        owner: "member-id",
        sharing: ProviderSharing.PRIVATE,
        shared_users: [],
      },
    });

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "providersettings",
      query: { types: ProviderType.MUSIC },
    });
  });

  it("sends a member away from a source it does not own", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    store.currentUser = user({ user_id: "member-id" });
    apiMock.getProviderConfig.mockResolvedValue({
      ...spotifyConfig(ProviderStatus.LOADED),
      access: {
        owner: "someone-else",
        sharing: ProviderSharing.MEMBERS,
        shared_users: [],
      },
    });

    const wrapper = shallowMount(EditProvider, {
      props: { instanceId: "spotify--test" },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    // the options are never shown; the member lands back on the list
    expect(routerMock.replace).toHaveBeenCalledWith({
      name: "providersettings",
      query: { types: ProviderType.MUSIC },
    });
    expect(wrapper.findComponent({ name: "EditConfig" }).exists()).toBe(false);
  });

  it("lets a member open a source it owns", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    store.currentUser = user({ user_id: "member-id" });
    apiMock.getProviderConfig.mockResolvedValue({
      ...spotifyConfig(ProviderStatus.LOADED),
      access: {
        owner: "member-id",
        sharing: ProviderSharing.PRIVATE,
        shared_users: [],
      },
    });

    const wrapper = shallowMount(EditProvider, {
      props: { instanceId: "spotify--test" },
      global: {
        mocks: { $t: (key: string) => key },
        stubs: providerDetailsStubs,
      },
    });
    await flushPromises();

    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(wrapper.findComponent({ name: "EditConfig" }).exists()).toBe(true);
  });

  it.each([
    [true, true],
    [false, false],
  ])(
    "offers a member reconfiguration of its own source only when members may set up the provider (self service: %s)",
    async (selfService, offered) => {
      authMock.hasScope.mockImplementation(
        scopeChecker(BUILTIN_ROLE_SCOPES.user),
      );
      store.currentUser = user({ user_id: "member-id" });
      apiMock.providerManifests.spotify.self_service = selfService;
      apiMock.getProviderConfig.mockResolvedValue({
        ...spotifyConfig(ProviderStatus.LOADED),
        access: {
          owner: "member-id",
          sharing: ProviderSharing.PRIVATE,
          shared_users: [],
        },
      });

      const wrapper = shallowMount(EditProvider, {
        props: { instanceId: "spotify--test" },
        global: {
          mocks: { $t: (key: string) => key },
          stubs: providerDetailsStubs,
        },
      });
      await flushPromises();

      expect(
        wrapper.find('[data-testid="provider-reconfigure"]').exists(),
      ).toBe(offered);
    },
  );
});

describe("EditProvider actions and sections", () => {
  it("offers what acts on the provider in the header menu, but not what the page shows itself", async () => {
    const wrapper = await mountProvider();

    expect(await visibleMenuLabels(wrapper)).toEqual([
      "settings.disable",
      "settings.reload",
      "settings.remove_provider",
      "settings.reset_to_defaults",
    ]);
  });

  it("offers to add a group player for a provider that creates them", async () => {
    apiMock.getProvider.mockReturnValue({
      available: true,
      domain: "spotify",
      instance_id: "spotify--test",
      is_streaming_provider: null,
      name: "Spotify",
      supported_features: [ProviderFeature.CREATE_GROUP_PLAYER],
      type: ProviderType.PLAYER,
    });
    const wrapper = await mountProvider();

    (await menuEntry(wrapper, "settings.add_group_player")).action?.();

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/addgroup/spotify--test",
    );
  });

  it("lets a member enable its own disabled source", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    store.currentUser = user({ user_id: "member-id" });
    const wrapper = await mountProvider(
      {
        ...spotifyConfig(
          ProviderStatus.DISABLED,
          "current value",
          undefined,
          false,
        ),
        access: {
          owner: "member-id",
          sharing: ProviderSharing.PRIVATE,
          shared_users: [],
        },
      },
      { VAlert: SlotStub },
    );

    expect(await visibleMenuLabels(wrapper)).toEqual([
      "settings.enable",
      "settings.reload",
      "settings.remove_provider",
      "settings.reset_to_defaults",
    ]);
    // the disabled banner offers it too
    expect(wrapper.find("v-btn-stub").exists()).toBe(true);
  });

  it("offers an admin to enable a disabled provider from its banner", async () => {
    const wrapper = await mountProvider(
      spotifyConfig(ProviderStatus.DISABLED, "current value", undefined, false),
      { VAlert: SlotStub },
    );

    expect(wrapper.find("v-btn-stub").exists()).toBe(true);
  });

  it("reloads the provider from the header menu", async () => {
    apiMock.reloadProvider.mockResolvedValue(undefined);
    const wrapper = await mountProvider();

    (await menuEntry(wrapper, "settings.reload")).action?.();
    await flushPromises();

    expect(apiMock.reloadProvider).toHaveBeenCalledWith("spotify--test");
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.provider_reloading",
    );
  });

  it("removes the provider from the header menu and leaves its page", async () => {
    apiMock.removeProviderConfig.mockResolvedValue(undefined);
    const discardChanges = vi.fn();
    const wrapper = await mountProvider(spotifyConfig(ProviderStatus.LOADED), {
      EditConfig: {
        name: "EditConfig",
        methods: { discardChanges },
        template: "<div />",
      },
    });

    (await menuEntry(wrapper, "settings.remove_provider")).action?.();
    const removeCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "deleteConfirmationDialog",
    );
    await removeCall?.[1].onConfirm();
    await flushPromises();

    expect(apiMock.removeProviderConfig).toHaveBeenCalledWith("spotify--test");
    // unsaved edits have nothing left to save to, so they must not hold the way out
    expect(discardChanges).toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith({
      name: "providersettings",
      query: { types: ProviderType.MUSIC },
    });
  });

  it("leaves another source opened during a removal untouched", async () => {
    let finishRemoval: () => void = () => {};
    apiMock.removeProviderConfig.mockReturnValue(
      new Promise<void>((resolve) => (finishRemoval = resolve)),
    );
    const discardChanges = vi.fn();
    const removed = spotifyConfig(ProviderStatus.LOADED);
    removed.name = "Old Spotify";
    const wrapper = await mountProvider(removed, {
      EditConfig: {
        name: "EditConfig",
        methods: { discardChanges },
        template: "<div />",
      },
    });

    (await menuEntry(wrapper, "settings.remove_provider")).action?.();
    const removeCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "deleteConfirmationDialog",
    );
    const removal = removeCall?.[1].onConfirm();

    // the user opens another source before the server confirms the removal
    const other = spotifyConfig(
      ProviderStatus.LOADED,
      "current value",
      undefined,
      true,
      "spotify--other",
    );
    other.name = "New Spotify";
    apiMock.getProviderConfig.mockResolvedValue(other);
    await wrapper.setProps({ instanceId: "spotify--other" });
    await flushPromises();
    finishRemoval();
    await removal;
    await flushPromises();

    // the stubbed t returns the key, so the name is checked where it is passed
    expect(i18nMock.t).toHaveBeenCalledWith("settings.provider_removed", [
      "Old Spotify",
    ]);
    expect(discardChanges).not.toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("shows the sections of the source with its access summary", async () => {
    const wrapper = await mountProvider();

    const links = wrapper.findComponent({ name: "ProviderSettingsLinks" });
    expect(links.props("config").instance_id).toBe("spotify--test");
    expect(links.props("accessSummary")).toBe(
      "settings.source_access.household · settings.source_access.options.everyone",
    );
  });

  it("opens the access dialog from its section and shows the saved access", async () => {
    const wrapper = await mountProvider();
    const links = wrapper.findComponent({ name: "ProviderSettingsLinks" });

    links.vm.$emit("access");
    await flushPromises();

    const dialog = wrapper.findComponent({ name: "ProviderAccessDialog" });
    expect(dialog.props("open")).toBe(true);
    expect(dialog.props("config").instance_id).toBe("spotify--test");
    expect(dialog.props("users")).toEqual([]);
    expect(dialog.props("canChangeOwner")).toBe(true);

    dialog.vm.$emit("saved", {
      ...spotifyConfig(ProviderStatus.LOADED),
      access: {
        owner: null,
        sharing: ProviderSharing.MEMBERS,
        shared_users: [],
      },
    });
    await flushPromises();

    expect(links.props("accessSummary")).toBe(
      "settings.source_access.household · settings.source_access.options.members",
    );
  });

  it.each([
    [ProviderType.MUSIC, 1],
    [ProviderType.PLAYER, 0],
  ])(
    "lists the users only for a source with an access section (%s)",
    async (type, calls) => {
      await mountProvider({ ...spotifyConfig(ProviderStatus.LOADED), type });

      expect(apiMock.getAllUsers).toHaveBeenCalledTimes(calls);
    },
  );

  it("lets a member share its own source with the members it may share with", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    store.currentUser = user({ user_id: "member-id" });
    const wrapper = await mountProvider({
      ...spotifyConfig(ProviderStatus.LOADED),
      access: {
        owner: "member-id",
        sharing: ProviderSharing.PRIVATE,
        shared_users: [],
      },
    });

    wrapper.findComponent({ name: "ProviderSettingsLinks" }).vm.$emit("access");
    await flushPromises();

    const dialog = wrapper.findComponent({ name: "ProviderAccessDialog" });
    expect(apiMock.getAllUsers).not.toHaveBeenCalled();
    expect(dialog.props("users")).toBeNull();
    expect(dialog.props("shareCandidates")).toEqual([]);
    expect(dialog.props("canChangeOwner")).toBe(false);
  });
});

/**
 * The spotify provider config these tests load, with a single `account` entry.
 */
function spotifyConfig(
  status: ProviderStatus,
  account: string = "current value",
  accountOptions?: { title: string; value: string }[],
  enabled: boolean = true,
  instanceId: string = "spotify--test",
): ProviderConfig {
  return providerConfig({
    domain: "spotify",
    enabled,
    instance_id: instanceId,
    last_error:
      status === ProviderStatus.AUTH_REQUIRED
        ? {
            error_code: 1,
            message: "Authentication required",
          }
        : null,
    status,
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
  });
}

/**
 * Mounts the provider page and saves the form, so the redirect it performs
 * afterwards is assertable.
 */
async function mountSavedProvider(
  config: ProviderConfig = spotifyConfig(ProviderStatus.LOADED),
) {
  apiMock.getProviderConfig.mockResolvedValue(config);
  apiMock.saveProviderConfig.mockResolvedValue(config);

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

  wrapper.findComponent({ name: "EditConfig" }).vm.$emit("submit", {});
  await flushPromises();
  return wrapper;
}

/**
 * Mounts the provider page the way the settings layout does, and hands back the
 * name it publishes for the breadcrumb above it.
 */
function mountFramedProvider(instanceId: string = "spotify--test") {
  let publishedName: Ref<string> | undefined;
  const SettingsFrame = defineComponent({
    setup() {
      publishedName = provideEditedProviderName();
      return () => h(EditProvider, { instanceId });
    },
  });

  const wrapper = shallowMount(SettingsFrame, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      // the page itself is what this frame is here to mount; everything below
      // it stays stubbed
      stubs: { ...providerDetailsStubs, EditProvider: false },
    },
  });
  return { wrapper, publishedName: publishedName! };
}

/**
 * Opens the header menu of the page and hands back its entry with the given
 * label.
 */
async function menuEntry(
  wrapper: VueWrapper,
  label: string,
): Promise<ContextMenuItem> {
  const entry = (await openHeaderMenu(wrapper)).find(
    (item) => item.label === label,
  );
  if (!entry) throw new Error(`no menu entry labeled ${label}`);
  return entry;
}

/**
 * Opens the header menu of the page and hands back the entries it offers.
 */
async function openHeaderMenu(wrapper: VueWrapper): Promise<ContextMenuItem[]> {
  await wrapper.get('[data-testid="provider-menu"]').trigger("click");
  const call = eventbusMock.emit.mock.calls
    .filter(([event]) => event === "contextmenu")
    .at(-1);
  if (!call) throw new Error("contextmenu was not emitted");
  return call[1].items;
}

/**
 * Mounts the provider page for the given config, once it has loaded.
 */
async function mountProvider(
  config: ProviderConfig = spotifyConfig(ProviderStatus.LOADED),
  stubs: Record<string, unknown> = {},
) {
  apiMock.getProviderConfig.mockResolvedValue(config);
  const wrapper = shallowMount(EditProvider, {
    props: { instanceId: config.instance_id },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { ...providerDetailsStubs, ...stubs },
    },
  });
  await flushPromises();
  return wrapper;
}

/**
 * Opens the header menu of the page and hands back the labels of the entries
 * it shows.
 */
async function visibleMenuLabels(wrapper: VueWrapper): Promise<string[]> {
  return (await openHeaderMenu(wrapper))
    .filter((item) => !item.hide)
    .map((item) => item.label);
}
