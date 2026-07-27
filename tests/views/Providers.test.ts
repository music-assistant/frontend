import { flushPromises, shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderStatus, ProviderType } from "@/plugins/api/interfaces";
import Providers from "@/views/settings/Providers.vue";

const { apiMock, eventbusMock, routeMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    getProvider: vi.fn(),
    getProviderConfigs: vi.fn(),
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
    removeProviderConfig: vi.fn(),
    saveProviderConfig: vi.fn(),
    sendCommand: vi.fn(),
    startSync: vi.fn(),
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
}));

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

vi.mock("@/composables/useBackgroundTasks", () => ({
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
    </div>
  `,
};

const SlotStub = {
  template: "<div><slot /></div>",
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
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
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
    setupFlowCall?.[1].onFlowEnded();
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
});

async function mountProviders(
  status: ProviderStatus,
  hasSetupFlow: boolean = true,
  enabled: boolean = true,
) {
  apiMock.providerManifests.spotify.has_setup_flow = hasSetupFlow;
  apiMock.getProviderConfigs.mockResolvedValue([
    {
      domain: "spotify",
      enabled,
      instance_id: "spotify--test",
      last_error: {
        error_code: 1,
        message: "Authentication required",
      },
      name: "Spotify",
      status,
      type: ProviderType.MUSIC,
    },
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
        VBtn: ButtonStub,
        VList: SlotStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
