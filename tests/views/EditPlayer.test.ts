import {
  isHassControlPickerEntry,
  type ConfigEntryUI,
} from "@/helpers/config_entry_ui";
import {
  ConfigEntryType,
  PlayerType,
  ProviderType,
  type ConfigEntry,
  type PlayerConfig,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import EditPlayer from "@/views/settings/EditPlayer.vue";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerManifest } from "../fixtures/providerManifest";

const { apiMock, eventbusMock, routerMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getDSPConfig: vi.fn<MusicAssistantApi["getDSPConfig"]>(),
    getPlayerConfig: vi.fn<MusicAssistantApi["getPlayerConfig"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
    players: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, unknown>,
    providers: {} as Record<string, unknown>,
    reloadProvider: vi.fn<MusicAssistantApi["reloadProvider"]>(),
    savePlayerConfig: vi.fn<MusicAssistantApi["savePlayerConfig"]>(),
    subscribe: vi.fn(),
  },
  eventbusMock: {
    emit: vi.fn(),
  },
  routerMock: {
    back: vi.fn(),
    push: vi.fn(),
  },
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const SlotStub = {
  template: "<div><slot /></div>",
};

const playerDetailsStubs = {
  Button: SlotStub,
  Card: SlotStub,
  CardContent: SlotStub,
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

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return { ...actual, useRouter: () => routerMock };
});

const CONTROL_KEYS = ["power_control", "volume_control", "mute_control"];

describe("EditPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.subscribe.mockReturnValue(vi.fn());
    apiMock.getDSPConfig.mockResolvedValue({
      enabled: false,
      filters: [],
      input_gain: 0,
      output_gain: 0,
    });
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig());
    apiMock.getProvider.mockReturnValue(providerInstance());
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({
        type: ProviderType.PLAYER,
        domain: "chromecast",
        name: "Chromecast",
      }),
    );
    apiMock.reloadProvider.mockResolvedValue(undefined);
    apiMock.savePlayerConfig.mockResolvedValue(playerConfig());
    apiMock.providerManifests = { chromecast: { name: "Chromecast" } };
    apiMock.players = {
      "player-1": playerState(),
    };
    apiMock.providers = {
      "hass--1": { instance_id: "hass--1", domain: "hass", available: true },
    };
    routerMock.push.mockResolvedValue(undefined);
  });

  it("shows setup, provider, reload, and enable controls in the header", async () => {
    const wrapper = await mountPlayerPage();

    expect(wrapper.get('[data-testid="player-setup"]').text()).toContain(
      "reconfigure_player",
    );
    expect(
      wrapper.get('[data-testid="player-provider-settings"]').text(),
    ).toContain("settings.provider_settings");
    expect(
      wrapper.get('[data-testid="player-reload-provider"]').text(),
    ).toContain("settings.reload_provider");
    expect(
      wrapper.get('[data-testid="player-toggle-enabled"]').text(),
    ).toContain("settings.disable");
  });

  it("hides optional reconfiguration when the player has no setup flow", async () => {
    apiMock.players = {
      "player-1": playerState({ hasSetupFlow: false }),
    };

    const wrapper = await mountPlayerPage();

    expect(wrapper.find('[data-testid="player-setup"]').exists()).toBe(false);
  });

  it("keeps required setup available without an optional setup flow", async () => {
    apiMock.players = {
      "player-1": playerState({
        hasSetupFlow: false,
        needsSetup: true,
      }),
    };

    const wrapper = await mountPlayerPage();
    expect(wrapper.get('[data-testid="player-setup"]').text()).toContain(
      "configure_player",
    );

    await wrapper.get('[data-testid="player-setup"]').trigger("click");

    expect(eventbusMock.emit).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "player",
      playerId: "player-1",
    });
  });

  it("hides setup actions while the player is disabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));

    const wrapper = await mountPlayerPage();

    expect(wrapper.find('[data-testid="player-setup"]').exists()).toBe(false);
  });

  it("opens the owning provider settings", async () => {
    const wrapper = await mountPlayerPage();

    await wrapper
      .get('[data-testid="player-provider-settings"]')
      .trigger("click");
    await flushPromises();

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "editprovider",
      params: { instanceId: "chromecast--1" },
    });
  });

  it("reports provider settings navigation failures", async () => {
    routerMock.push.mockRejectedValueOnce(new Error("Navigation failed"));
    const wrapper = await mountPlayerPage();

    await wrapper
      .get('[data-testid="player-provider-settings"]')
      .trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("Error: Navigation failed");
  });

  it("reports navigation failures returned by the router", async () => {
    routerMock.push.mockResolvedValueOnce(new Error("Navigation blocked"));
    const wrapper = await mountPlayerPage();

    await wrapper
      .get('[data-testid="player-provider-settings"]')
      .trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("Error: Navigation blocked");
  });

  it("uses the configured provider when its live instance is unavailable", async () => {
    apiMock.getProvider.mockReturnValue(undefined);

    const wrapper = await mountPlayerPage();

    expect(
      wrapper.find('[data-testid="player-provider-settings"]').exists(),
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="player-reload-provider"]').exists(),
    ).toBe(true);

    await wrapper
      .get('[data-testid="player-reload-provider"]')
      .trigger("click");
    await flushPromises();

    expect(apiMock.reloadProvider).toHaveBeenCalledWith("chromecast--1");
  });

  it("reloads the owning provider from the header menu", async () => {
    const wrapper = await mountPlayerPage();

    await wrapper
      .get('[data-testid="player-reload-provider"]')
      .trigger("click");
    await flushPromises();

    expect(apiMock.reloadProvider).toHaveBeenCalledWith("chromecast--1");
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.provider_reloading",
    );
  });

  it("reports provider reload failures without navigating", async () => {
    apiMock.reloadProvider.mockRejectedValueOnce(new Error("Reload failed"));
    const wrapper = await mountPlayerPage();

    await wrapper
      .get('[data-testid="player-reload-provider"]')
      .trigger("click");
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("Error: Reload failed");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("keeps player settings available while the provider reload is pending", async () => {
    let resolveReload: () => void = () => {};
    apiMock.reloadProvider.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveReload = resolve;
        }),
    );
    const wrapper = await mountPlayerPage();

    await wrapper
      .get('[data-testid="player-reload-provider"]')
      .trigger("click");

    expect(
      wrapper.findComponent({ name: "VOverlay" }).props("modelValue"),
    ).toBe(false);
    resolveReload();
    await flushPromises();
  });

  it("disables the player from the header menu", async () => {
    apiMock.savePlayerConfig.mockResolvedValueOnce(
      playerConfig({ enabled: false }),
    );
    const wrapper = await mountPlayerPage();

    await wrapper.get('[data-testid="player-toggle-enabled"]').trigger("click");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("player-1", {
      enabled: false,
    });
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="player-toggle-enabled"]').text(),
    ).toContain("settings.enable");
    expect(toastMock.success).toHaveBeenCalledWith("settings.player_saved");
  });

  it("enables a disabled player from the header menu", async () => {
    apiMock.getPlayerConfig.mockResolvedValueOnce(
      playerConfig({ enabled: false }),
    );
    apiMock.savePlayerConfig.mockResolvedValueOnce(playerConfig());
    const wrapper = await mountPlayerPage();

    expect(
      wrapper.get('[data-testid="player-toggle-enabled"]').text(),
    ).toContain("settings.enable");
    await wrapper.get('[data-testid="player-toggle-enabled"]').trigger("click");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("player-1", {
      enabled: true,
    });
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(false);
  });

  it("keeps pending config edits while toggling the player", async () => {
    apiMock.savePlayerConfig.mockResolvedValueOnce(
      playerConfig({ enabled: false }),
    );
    const wrapper = await mountPlayerPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    const editedEntry = editConfig
      .props("configEntries")
      .find((entry: ConfigEntry) => entry.key === "volume_normalization");
    editedEntry.value = false;

    await wrapper.get('[data-testid="player-toggle-enabled"]').trigger("click");
    await flushPromises();

    expect(
      editConfig
        .props("configEntries")
        .find((entry: ConfigEntry) => entry.key === "volume_normalization")
        .value,
    ).toBe(false);
  });

  it("reconciles player state when a toggle fails", async () => {
    apiMock.getPlayerConfig
      .mockResolvedValueOnce(playerConfig())
      .mockResolvedValueOnce(playerConfig({ enabled: false }));
    apiMock.savePlayerConfig.mockRejectedValueOnce(new Error("Save failed"));
    const wrapper = await mountPlayerPage();

    await wrapper.get('[data-testid="player-toggle-enabled"]').trigger("click");
    await flushPromises();

    expect(apiMock.getPlayerConfig).toHaveBeenCalledTimes(2);
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(true);
    expect(toastMock.error).toHaveBeenCalledWith("Error: Save failed");
  });

  it("allows a new player toggle while the previous toggle is pending", async () => {
    let resolveSave: (config: PlayerConfig) => void = () => {};
    apiMock.getPlayerConfig
      .mockResolvedValueOnce(playerConfig())
      .mockResolvedValueOnce(playerConfig({ playerId: "player-2" }));
    apiMock.savePlayerConfig
      .mockImplementationOnce(
        () =>
          new Promise<PlayerConfig>((resolve) => {
            resolveSave = resolve;
          }),
      )
      .mockResolvedValueOnce(
        playerConfig({ enabled: false, playerId: "player-2" }),
      );
    apiMock.players = {
      "player-1": playerState(),
      "player-2": playerState({ playerId: "player-2" }),
    };
    const wrapper = await mountPlayerPage();

    await wrapper.get('[data-testid="player-toggle-enabled"]').trigger("click");
    await wrapper.setProps({ playerId: "player-2" });
    await flushPromises();
    await wrapper.get('[data-testid="player-toggle-enabled"]').trigger("click");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenNthCalledWith(2, "player-2", {
      enabled: false,
    });
    resolveSave(playerConfig({ enabled: false }));
    await flushPromises();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(true);
    expect(toastMock.success).toHaveBeenCalledTimes(1);
  });

  it("ignores stale navigation failures after moving to another player", async () => {
    let rejectNavigation: (error: Error) => void = () => {};
    routerMock.push.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectNavigation = reject;
        }),
    );
    apiMock.getPlayerConfig
      .mockResolvedValueOnce(playerConfig())
      .mockResolvedValueOnce(playerConfig({ playerId: "player-2" }));
    apiMock.players = {
      "player-1": playerState(),
      "player-2": playerState({ playerId: "player-2" }),
    };
    const wrapper = await mountPlayerPage();

    await wrapper
      .get('[data-testid="player-provider-settings"]')
      .trigger("click");
    await wrapper.setProps({ playerId: "player-2" });
    await flushPromises();
    rejectNavigation(new Error("Old navigation failed"));
    await flushPromises();

    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("offers the entity picker under every player control entry", async () => {
    const keys = (await mountEditPlayer()).map((entry) => entry.key);

    for (const controlKey of CONTROL_KEYS) {
      expect(keys[keys.indexOf(controlKey) + 1]).toBe(
        `${controlKey}_hass_control_picker`,
      );
    }
  });

  it("points each picker at the control list that registers its entity", async () => {
    const entries = await mountEditPlayer();
    const pickers = entries.filter(isHassControlPickerEntry);

    expect(
      pickers.map((picker) => [
        picker.target_key,
        picker.hass_control_key,
        picker.hass_instance_id,
      ]),
    ).toEqual([
      ["power_control", "power_controls", "hass--1"],
      ["volume_control", "volume_controls", "hass--1"],
      ["mute_control", "mute_controls", "hass--1"],
    ]);
  });

  it("leaves the picker out while Home Assistant is unavailable", async () => {
    apiMock.providers = {
      "hass--1": { instance_id: "hass--1", domain: "hass", available: false },
    };

    const entries = await mountEditPlayer();

    expect(entries.some(isHassControlPickerEntry)).toBe(false);
  });

  it("leaves the picker out without a Home Assistant provider", async () => {
    apiMock.providers = {};

    const entries = await mountEditPlayer();

    expect(entries.some(isHassControlPickerEntry)).toBe(false);
  });
});

function controlEntry(key: string): ConfigEntry {
  return {
    key,
    type: ConfigEntryType.STRING,
    label: key,
    category: "player_controls",
    required: false,
    default_value: "none",
    value: "none",
    options: [{ title: "none", value: "none" }],
  };
}

function providerInstance(): ProviderInstance {
  return {
    type: ProviderType.PLAYER,
    domain: "chromecast",
    instance_id: "chromecast--1",
    name: "Chromecast",
    available: true,
    supported_features: [],
  };
}

function playerConfig({
  enabled = true,
  playerId = "player-1",
}: {
  enabled?: boolean;
  playerId?: string;
} = {}): PlayerConfig {
  return {
    player_id: playerId,
    provider: "chromecast--1",
    enabled,
    values: {
      volume_normalization: {
        key: "volume_normalization",
        type: ConfigEntryType.BOOLEAN,
        label: "volume_normalization",
        category: "audio",
        options: [],
        required: false,
        default_value: true,
        value: true,
      },
      ...Object.fromEntries(
        CONTROL_KEYS.map((key) => [key, controlEntry(key)]),
      ),
    },
  };
}

function playerState({
  hasSetupFlow = true,
  needsSetup = false,
  playerId = "player-1",
}: {
  hasSetupFlow?: boolean;
  needsSetup?: boolean;
  playerId?: string;
} = {}) {
  return {
    available: true,
    device_info: { manufacturer: "", model: "", identifiers: {} },
    enabled: true,
    has_setup_flow: hasSetupFlow,
    name: playerId,
    needs_setup: needsSetup,
    options: [],
    output_protocols: [],
    player_id: playerId,
    supported_features: [],
    type: PlayerType.PLAYER,
  };
}

async function mountPlayerPage(playerId: string = "player-1") {
  const wrapper = shallowMount(EditPlayer, {
    props: { playerId },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: playerDetailsStubs,
    },
  });
  await flushPromises();
  return wrapper;
}

async function mountEditPlayer(): Promise<ConfigEntryUI[]> {
  const wrapper = await mountPlayerPage();
  return wrapper
    .findComponent({ name: "EditConfig" })
    .props("configEntries") as ConfigEntryUI[];
}
