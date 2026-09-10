import { flushPromises, shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ProviderConfig,
  ProviderSharing,
  ProviderStage,
  ProviderStatus,
  ProviderType,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import Providers from "@/views/settings/Providers.vue";
import { providerConfig } from "../fixtures/providerConfig";
import { user } from "../fixtures/user";

const { apiMock, eventbusMock, routeMock, routerMock, toastMock } = vi.hoisted(
  () => ({
    apiMock: {
      getAllUsers: vi.fn<MusicAssistantApi["getAllUsers"]>(),
      getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
      getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
      providerManifests: {
        spotify: {
          allow_disable: true,
          builtin: false,
          description: "Spotify music provider",
          documentation: "https://example.com",
          has_setup_flow: true,
          name: "Spotify",
          stage: "stable",
        },
      },
      providers: {},
      reloadProvider: vi.fn<MusicAssistantApi["reloadProvider"]>(),
      removeProviderConfig: vi.fn<MusicAssistantApi["removeProviderConfig"]>(),
      saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
      startSync: vi.fn<MusicAssistantApi["startSync"]>(),
      subscribe: vi.fn(),
    },
    eventbusMock: {
      emit: vi.fn(),
    },
    routeMock: {
      query: { types: "music" },
    },
    routerMock: {
      push: vi.fn(),
    },
    toastMock: {
      error: vi.fn(),
    },
  }),
);

const owner = user({
  display_name: "Marcel",
  user_id: "user-marcel",
  username: "marcel",
});

const member = user({ user_id: "user-sam", username: "sam" });

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/plugins/router", () => ({
  default: routerMock,
}));

vi.mock("@/composables/background-tasks/useBackgroundTasks", () => ({
  useBackgroundTasks: () => ({
    isProviderSyncing: () => false,
  }),
}));

vi.mock("@/helpers/utils", () => ({
  openLinkInNewTab: vi.fn(),
}));

vi.mock("@/views/settings/AddProviderDialog.vue", () => ({
  default: {
    template: "<div />",
  },
}));

// rendered in place of the real dialog, exposing what it was handed
const AccessDialogStub = vi.hoisted(() => ({
  name: "ProviderAccessDialog",
  props: ["config", "open", "users"],
  template: `
    <div
      data-testid="access-dialog"
      :data-open="String(open)"
      :data-config="config?.instance_id ?? ''"
    />
  `,
}));

vi.mock("@/components/settings/providers/ProviderAccessDialog.vue", () => ({
  default: AccessDialogStub,
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRoute: () => routeMock,
    useRouter: () => routerMock,
  };
});

const ListItemStub = {
  name: "ListItem",
  emits: ["click", "menu"],
  template: `
    <div data-testid="provider-row" @click="$emit('click')">
      <slot name="subtitle" />
      <slot name="append" />
    </div>
  `,
};

const SlotStub = {
  template: "<div><slot /></div>",
};

const ChipStub = {
  template: '<div data-testid="stage-badge"><slot /></div>',
};

const ButtonStub = {
  emits: ["click"],
  template: `
    <button data-testid="provider-action" @click="$emit('click', $event)">
      <slot />
    </button>
  `,
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getAllUsers.mockResolvedValue([owner, member]);
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.providerManifests.spotify.builtin = false;
  apiMock.providerManifests.spotify.stage = ProviderStage.STABLE;
  apiMock.reloadProvider.mockResolvedValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
  routeMock.query.types = "music";
});

describe("Providers", () => {
  it("opens reconfiguration when an authentication-required provider is clicked", async () => {
    const wrapper = await mountProviders(ProviderStatus.AUTH_REQUIRED);

    await wrapper.get('[data-testid="provider-row"]').trigger("click");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--test",
      onFlowEnded: expect.any(Function),
    });
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("opens options when a provider with a generic error is clicked", async () => {
    const wrapper = await mountProviders(ProviderStatus.ERROR);

    await wrapper.get('[data-testid="provider-row"]').trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
    expect(eventbusMock.emit).not.toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.anything(),
    );
  });

  it("opens options when an authentication-required provider has no setup flow", async () => {
    const wrapper = await mountProviders(ProviderStatus.AUTH_REQUIRED, false);

    await wrapper.get('[data-testid="provider-row"]').trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
    expect(wrapper.find('[data-testid="provider-action"]').exists()).toBe(
      false,
    );
  });

  it("starts reconfiguration from the provider warning action", async () => {
    const wrapper = await mountProviders(ProviderStatus.ERROR);

    await wrapper.get('[data-testid="provider-action"]').trigger("click");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--test",
      onFlowEnded: expect.any(Function),
    });
    expect(routerMock.push).not.toHaveBeenCalled();

    const setupFlowCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "setupFlowDialog",
    );
    setupFlowCall?.[1].onFlowEnded(true);
    await flushPromises();
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(2);
  });

  it("offers separate reconfigure and options menu actions", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);
    const menuEvent = new Event("click");

    wrapper.findComponent(ListItemStub).vm.$emit("menu", menuEvent);

    const contextMenuCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "contextmenu",
    );
    const menuItems = contextMenuCall?.[1].items;
    expect(
      menuItems.slice(0, 2).map((item: { label: string }) => item.label),
    ).toEqual(["settings.reconfigure", "settings.options"]);

    menuItems[0].action();
    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: "spotify--test",
      onFlowEnded: expect.any(Function),
    });

    menuItems[1].action();
    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/spotify--test",
    );
  });

  it("reloads a provider through the shared API action", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    wrapper.findComponent(ListItemStub).vm.$emit("menu", new Event("click"));

    const contextMenuCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "contextmenu",
    );
    const reloadItem = contextMenuCall?.[1].items.find(
      (item: { label: string }) => item.label === "settings.reload_provider",
    );
    reloadItem.action();

    expect(apiMock.reloadProvider).toHaveBeenCalledWith("spotify--test");
  });

  it("omits reconfigure from the menu when no setup flow exists", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, false);

    wrapper.findComponent(ListItemStub).vm.$emit("menu", new Event("click"));

    const contextMenuCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "contextmenu",
    );
    const menuItems = contextMenuCall?.[1].items;
    expect(
      menuItems.map((item: { label: string }) => item.label),
    ).not.toContain("settings.reconfigure");
    expect(menuItems[0].label).toBe("settings.options");
  });

  it("omits reconfigure for disabled providers", async () => {
    const wrapper = await mountProviders(ProviderStatus.DISABLED, true, false);

    wrapper.findComponent(ListItemStub).vm.$emit("menu", new Event("click"));

    const contextMenuCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "contextmenu",
    );
    const menuItems = contextMenuCall?.[1].items;
    expect(
      menuItems.map((item: { label: string }) => item.label),
    ).not.toContain("settings.reconfigure");
    expect(menuItems[0].label).toBe("settings.options");
  });

  it("omits reconfigure for incompatible providers", async () => {
    const wrapper = await mountProviders(ProviderStatus.INCOMPATIBLE);

    wrapper.findComponent(ListItemStub).vm.$emit("menu", new Event("click"));

    const contextMenuCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "contextmenu",
    );
    const menuItems = contextMenuCall?.[1].items;
    expect(
      menuItems.map((item: { label: string }) => item.label),
    ).not.toContain("settings.reconfigure");
  });

  it("labels the stage badge from the translated stage key", async () => {
    apiMock.providerManifests.spotify.stage = ProviderStage.DEPRECATED;

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(wrapper.get('[data-testid="stage-badge"]').text()).toBe(
      "settings.stage.options.deprecated",
    );
  });

  it("hides the stage badge for a stable provider", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(wrapper.find('[data-testid="stage-badge"]').exists()).toBe(false);
  });

  it("summarizes a music source without an access record as a household one", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
      "settings.source_access.household · settings.source_access.options.everyone",
    );
  });

  it("summarizes a music source shared with selected members", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      access: {
        owner: "user-marcel",
        shared_users: ["user-sam"],
        sharing: ProviderSharing.SELECTED,
      },
    });

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
      "Marcel · settings.source_access.shared_with_count",
    );
  });

  it("falls back to the raw id of an owner that is not a known user", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      access: {
        owner: "user-gone",
        shared_users: [],
        sharing: ProviderSharing.PRIVATE,
      },
    });

    expect(wrapper.get('[data-testid="provider-access"]').text()).toBe(
      "user-gone · settings.source_access.options.private",
    );
  });

  it("opens the access dialog from the provider menu", async () => {
    const wrapper = await mountProviders(ProviderStatus.LOADED);

    wrapper.findComponent(ListItemStub).vm.$emit("menu", new Event("click"));

    const contextMenuCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "contextmenu",
    );
    const menuItems = contextMenuCall?.[1].items;
    expect(
      menuItems.slice(0, 3).map((item: { label: string }) => item.label),
    ).toEqual([
      "settings.reconfigure",
      "settings.options",
      "settings.source_access.action",
    ]);

    menuItems[2].action();
    await flushPromises();

    const dialog = wrapper.get('[data-testid="access-dialog"]');
    expect(dialog.attributes("data-open")).toBe("true");
    expect(dialog.attributes("data-config")).toBe("spotify--test");
  });

  it("hides the access action for a builtin provider", async () => {
    apiMock.providerManifests.spotify.builtin = true;

    const wrapper = await mountProviders(ProviderStatus.LOADED);

    wrapper.findComponent(ListItemStub).vm.$emit("menu", new Event("click"));

    const contextMenuCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "contextmenu",
    );
    const accessItem = contextMenuCall?.[1].items.find(
      (item: { label: string }) =>
        item.label === "settings.source_access.action",
    );
    expect(accessItem.hide).toBe(true);
    expect(wrapper.find('[data-testid="provider-access"]').exists()).toBe(
      false,
    );
  });

  it("hides the access action for a player provider", async () => {
    routeMock.query.types = "player";

    const wrapper = await mountProviders(ProviderStatus.LOADED, true, true, {
      type: ProviderType.PLAYER,
    });

    wrapper.findComponent(ListItemStub).vm.$emit("menu", new Event("click"));

    const contextMenuCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "contextmenu",
    );
    const accessItem = contextMenuCall?.[1].items.find(
      (item: { label: string }) =>
        item.label === "settings.source_access.action",
    );
    expect(accessItem.hide).toBe(true);
    expect(wrapper.find('[data-testid="provider-access"]').exists()).toBe(
      false,
    );
  });

  it("reports a failing user lookup", async () => {
    apiMock.getAllUsers.mockRejectedValue(new Error("no users"));

    await mountProviders(ProviderStatus.LOADED);

    expect(toastMock.error).toHaveBeenCalledWith("auth.users_load_failed");
  });
});

async function mountProviders(
  status: ProviderStatus,
  hasSetupFlow: boolean = true,
  enabled: boolean = true,
  configOverrides: Partial<ProviderConfig> = {},
) {
  apiMock.providerManifests.spotify.has_setup_flow = hasSetupFlow;
  apiMock.getProviderConfigs.mockResolvedValue([
    providerConfig({
      domain: "spotify",
      enabled,
      instance_id: "spotify--test",
      last_error: {
        error_code: 1,
        message: "Authentication required",
      },
      name: "Spotify",
      status,
      ...configOverrides,
    }),
  ]);

  const wrapper = shallowMount(Providers, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      provide: {
        providersViewMode: {
          toggleViewMode: vi.fn(),
          viewMode: ref<"list" | "card">("list"),
        },
      },
      stubs: {
        Container: SlotStub,
        ListItem: ListItemStub,
        ProviderAccessDialog: AccessDialogStub,
        VBtn: ButtonStub,
        VChip: ChipStub,
        VList: SlotStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
