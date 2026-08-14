import {
  isHassControlPickerEntry,
  type ConfigEntryUI,
} from "@/helpers/config_entry_ui";
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

const { apiMock, editConfigResetMock, routerMock, toastMock } = vi.hoisted(
  () => ({
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
    editConfigResetMock: vi.fn(),
    routerMock: {
      back: vi.fn(),
      push: vi.fn(),
    },
    toastMock: {
      error: vi.fn(),
      success: vi.fn(),
    },
  }),
);

const SlotStub = {
  template: "<div><slot /></div>",
};

const playerDetailsStubs = {
  // rendered for real so this screen's advanced toggle stays assertable
  AdvancedSettingsToggle: false,
  Button: SlotStub,
  EditConfig: {
    name: "EditConfig",
    props: [
      "configEntries",
      "disabled",
      "outputProtocols",
      "showAdvancedSettings",
    ],
    methods: {
      resetToDefaults: editConfigResetMock,
    },
    template: "<div />",
  },
};

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
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
  });

  it("offers the advanced toggle and a reset beside the form", async () => {
    const wrapper = await mountPlayerPage();

    expect(
      wrapper.find('[data-testid="player-advanced-settings"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('[data-testid="player-reset-defaults"]').text(),
    ).toContain("settings.reset_to_defaults");
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

  it("controls advanced settings from the action row", async () => {
    const wrapper = await mountPlayerPage();
    const editConfig = wrapper.findComponent({ name: "EditConfig" });

    wrapper
      .findComponent({ name: "Switch" })
      .vm.$emit("update:modelValue", true);
    await wrapper.vm.$nextTick();

    expect(editConfig.props("showAdvancedSettings")).toBe(true);
  });

  it("resets the form to its defaults", async () => {
    const wrapper = await mountPlayerPage();

    await wrapper.get('[data-testid="player-reset-defaults"]').trigger("click");

    expect(editConfigResetMock).toHaveBeenCalledOnce();
  });

  it("leaves nothing to edit while the player is disabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));

    const wrapper = await mountPlayerPage();

    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(true);
    expect(
      wrapper
        .get('[data-testid="player-reset-defaults"]')
        .attributes("disabled"),
    ).toBe("true");
    expect(
      wrapper.find('[data-testid="player-advanced-settings"]').exists(),
    ).toBe(false);
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
    name: null,
    default_name: null,
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

/**
 * Deliver the event the screen reloads its config on.
 */
function providersUpdated() {
  for (const [eventType, callback] of apiMock.subscribe.mock.calls) {
    if (eventType === EventType.PROVIDERS_UPDATED) callback();
  }
}

/**
 * Deliver the config change the page around this form makes when the player is
 * enabled or disabled.
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
