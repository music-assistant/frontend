import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  isHassControlPickerEntry,
  type ConfigEntryUI,
} from "@/helpers/config_entry_ui";
import type { getPlayerSettingsMenuItems as buildPlayerSettingsMenuItems } from "@/helpers/player_settings_actions";
import {
  ConfigEntryType,
  EventType,
  PlayerType,
  ProviderType,
  type ConfigEntry,
  type PlayerConfig,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import EditPlayer from "@/views/settings/EditPlayer.vue";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerManifest } from "../fixtures/providerManifest";

const {
  apiMock,
  editConfigDiscardMock,
  editConfigResetMock,
  emitEvent,
  getPlayerSettingsMenuItems,
  routerMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    getPlayerConfig: vi.fn<MusicAssistantApi["getPlayerConfig"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
    players: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, unknown>,
    providers: {} as Record<string, unknown>,
    savePlayerConfig: vi.fn<MusicAssistantApi["savePlayerConfig"]>(),
    subscribe: vi.fn(),
  },
  editConfigDiscardMock: vi.fn(),
  editConfigResetMock: vi.fn(),
  emitEvent: vi.fn(),
  getPlayerSettingsMenuItems: vi.fn<typeof buildPlayerSettingsMenuItems>(),
  routerMock: {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
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
  // rendered for real so this screen's advanced toggle stays assertable
  AdvancedSettingsToggle: false,
  Button: SlotStub,
  Card: SlotStub,
  CardContent: SlotStub,
  CardHeader: SlotStub,
  EditConfig: {
    name: "EditConfig",
    props: [
      "configEntries",
      "disabled",
      "outputProtocols",
      "showAdvancedSettings",
    ],
    methods: {
      discardChanges: editConfigDiscardMock,
      resetToDefaults: editConfigResetMock,
    },
    template: "<div />",
  },
  PlayerSettingsLinks: true,
  VAlert: SlotStub,
  VBtn: { template: '<button class="v-btn"><slot /></button>' },
};

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: emitEvent },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

// the shared menu is covered where it is built
vi.mock("@/helpers/player_settings_actions", () => ({
  getPlayerName: (config: PlayerConfig) => config.name ?? config.default_name,
  getPlayerSettingsMenuItems,
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
  // the api mock is a module singleton, so a component left mounted keeps
  // answering the next test's events
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.subscribe.mockReturnValue(vi.fn());
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig());
    apiMock.getProvider.mockReturnValue(providerInstance());
    apiMock.getProviderManifest.mockReturnValue(
      providerManifest({
        type: ProviderType.PLAYER,
        domain: "chromecast",
        name: "Chromecast",
      }),
    );
    apiMock.savePlayerConfig.mockResolvedValue(playerConfig());
    apiMock.providerManifests = { chromecast: { name: "Chromecast" } };
    apiMock.players = {
      "player-1": playerState(),
    };
    apiMock.providers = {
      "hass--1": { instance_id: "hass--1", domain: "hass", available: true },
    };
    routerMock.push.mockResolvedValue(undefined);
    // a fresh array per call, since the page appends its own entry to it
    getPlayerSettingsMenuItems.mockImplementation(() => [
      { label: "settings.delete" },
    ]);
  });

  it("names the player in the header", async () => {
    const wrapper = await mountPlayerPage();

    expect(wrapper.get("h2").text()).toBe("Kitchen");
  });

  it("offers the setup and the advanced toggle in the header", async () => {
    const wrapper = await mountPlayerPage();

    expect(wrapper.get('[data-testid="player-setup"]').text()).toContain(
      "reconfigure_player",
    );
    expect(
      wrapper.find('[data-testid="player-advanced-settings"]').exists(),
    ).toBe(true);
  });

  it("leaves out the advanced toggle without advanced settings to reveal", async () => {
    const config = playerConfig();
    delete config.values.sample_rates;
    apiMock.getPlayerConfig.mockResolvedValue(config);

    const wrapper = await mountPlayerPage();

    expect(
      wrapper.find('[data-testid="player-advanced-settings"]').exists(),
    ).toBe(false);
  });

  it("controls advanced settings from the header", async () => {
    const wrapper = await mountPlayerPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });

    wrapper
      .findComponent({ name: "Switch" })
      .vm.$emit("update:modelValue", true);
    await wrapper.vm.$nextTick();

    expect(editConfig.props("showAdvancedSettings")).toBe(true);
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
      "player-1": playerState({ hasSetupFlow: false, needsSetup: true }),
    };

    const wrapper = await mountPlayerPage();
    expect(wrapper.text()).toContain("settings.player_needs_setup");
    expect(wrapper.get('[data-testid="player-setup"]').text()).toContain(
      "configure_player",
    );

    await wrapper.get('[data-testid="player-setup"]').trigger("click");

    expect(emitEvent).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "player",
      playerId: "player-1",
    });
  });

  it("hides setup actions while the player is disabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));

    const wrapper = await mountPlayerPage();

    expect(wrapper.find('[data-testid="player-setup"]').exists()).toBe(false);
  });

  it("reports a player that cannot be reached", async () => {
    apiMock.players = { "player-1": playerState({ available: false }) };

    const wrapper = await mountPlayerPage();

    expect(wrapper.text()).toContain("settings.player_not_available");
  });

  it("offers to enable a disabled player", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));
    apiMock.savePlayerConfig.mockResolvedValueOnce(playerConfig());
    const wrapper = await mountPlayerPage();
    expect(wrapper.text()).toContain("settings.player_disabled");

    await wrapper.get(".v-btn").trigger("click");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("player-1", {
      enabled: true,
    });
    expect(toastMock.success).toHaveBeenCalledWith("settings.player_saved");
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(false);
  });

  it("opens the shared player menu from the kebab", async () => {
    const wrapper = await mountPlayerPage();

    await wrapper
      .get('[data-testid="player-menu"]')
      .trigger("click", { clientX: 10, clientY: 20 });

    expect(getPlayerSettingsMenuItems).toHaveBeenCalledWith(
      expect.objectContaining({ player_id: "player-1" }),
      expect.objectContaining({ onDeleted: expect.any(Function) }),
    );
    expect(emitEvent).toHaveBeenCalledWith("contextmenu", {
      items: expect.arrayContaining([{ label: "settings.delete" }]),
      posX: 10,
      posY: 20,
    });
  });

  it("resets the form from the same menu", async () => {
    const wrapper = await mountPlayerPage();

    await wrapper.get('[data-testid="player-menu"]').trigger("click");
    resetMenuItem()?.action?.();

    expect(editConfigResetMock).toHaveBeenCalledOnce();
  });

  it("keeps the reset out of reach while the player is disabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));
    const wrapper = await mountPlayerPage();

    await wrapper.get('[data-testid="player-menu"]').trigger("click");

    expect(resetMenuItem()?.disabled).toBe(true);
  });

  it("leaves the settings page once the player is deleted", async () => {
    const wrapper = await mountPlayerPage();
    await wrapper.get('[data-testid="player-menu"]').trigger("click");

    getPlayerSettingsMenuItems.mock.calls[0][1]!.onDeleted!();

    // a step back would land on the page of the player that was just deleted
    expect(routerMock.replace).toHaveBeenCalledWith({ name: "playersettings" });
    expect(routerMock.back).not.toHaveBeenCalled();
    // pending edits have nothing left to save to, so they must not hold the
    // unsaved-changes guard and strand the user on a deleted player
    expect(editConfigDiscardMock).toHaveBeenCalled();
  });

  it("renames the player from the header", async () => {
    const wrapper = await mountPlayerPage();

    await wrapper.get('[title="settings.player_name"]').trigger("click");

    expect(emitEvent).toHaveBeenCalledWith("playerRenameDialog", {
      playerId: "player-1",
      name: "Kitchen",
      defaultName: "Chromecast",
    });
  });

  it("keeps pending edits while the provider list refreshes the config", async () => {
    const wrapper = await mountPlayerPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    const editedEntry = editConfig
      .props("configEntries")
      .find((entry: ConfigEntry) => entry.key === "volume_normalization");
    editedEntry.value = false;
    apiMock.getPlayerConfig.mockResolvedValueOnce(
      playerConfig({ enabled: false }),
    );

    providersUpdated();
    await flushPromises();

    expect(editConfig.props("disabled")).toBe(true);
    expect(
      editConfig
        .props("configEntries")
        .find((entry: ConfigEntry) => entry.key === "volume_normalization")
        .value,
    ).toBe(false);
  });

  it("follows the player being disabled around the form", async () => {
    const wrapper = await mountPlayerPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    expect(editConfig.props("disabled")).toBe(false);
    apiMock.getPlayerConfig.mockResolvedValueOnce(
      playerConfig({ enabled: false }),
    );

    playerConfigUpdated("player-1");
    await flushPromises();

    // a save that still believed the player was enabled would write that back
    expect(editConfig.props("disabled")).toBe(true);
  });

  it("reopens the form when the player is enabled again", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));
    const wrapper = await mountPlayerPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    expect(editConfig.props("disabled")).toBe(true);
    apiMock.getPlayerConfig.mockResolvedValueOnce(playerConfig());

    playerConfigUpdated("player-1");
    await flushPromises();

    expect(editConfig.props("disabled")).toBe(false);
  });

  it("ignores a config change for another player", async () => {
    const wrapper = await mountPlayerPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });
    apiMock.getPlayerConfig.mockResolvedValueOnce(
      playerConfig({ enabled: false }),
    );

    playerConfigUpdated("player-2");
    await flushPromises();

    expect(editConfig.props("disabled")).toBe(false);
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
    is_streaming_provider: null,
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
    name: "Kitchen",
    default_name: "Chromecast",
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
      sample_rates: {
        key: "sample_rates",
        type: ConfigEntryType.INTEGER,
        label: "sample_rates",
        category: "audio",
        advanced: true,
        options: [],
        required: false,
        default_value: 44100,
        value: 44100,
      },
      ...Object.fromEntries(
        CONTROL_KEYS.map((key) => [key, controlEntry(key)]),
      ),
    },
  };
}

function playerState({
  available = true,
  hasSetupFlow = true,
  needsSetup = false,
  playerId = "player-1",
}: {
  available?: boolean;
  hasSetupFlow?: boolean;
  needsSetup?: boolean;
  playerId?: string;
} = {}) {
  return {
    available,
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

/**
 * The entry the page adds to the menu it shares with the other player surfaces.
 */
function resetMenuItem(): ContextMenuItem | undefined {
  const call = emitEvent.mock.calls.find(([event]) => event === "contextmenu");
  const items = (call?.[1] as { items: ContextMenuItem[] } | undefined)?.items;
  return items?.find((item) => item.label === "settings.reset_to_defaults");
}

/**
 * Deliver the event the screen reloads its config on.
 */
function providersUpdated() {
  for (const [eventType, callback] of apiMock.subscribe.mock.calls) {
    if (eventType === EventType.PROVIDERS_UPDATED) callback();
  }
}

/**
 * Deliver the config change the server sends when the player is renamed,
 * enabled or disabled elsewhere.
 */
function playerConfigUpdated(playerId: string) {
  for (const [eventType, callback] of apiMock.subscribe.mock.calls) {
    if (eventType === EventType.PLAYER_CONFIG_UPDATED) {
      callback({ object_id: playerId });
    }
  }
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
