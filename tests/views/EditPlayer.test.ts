import {
  isHassControlPickerEntry,
  type ConfigEntryUI,
} from "@/helpers/config_entry_ui";
import {
  ConfigEntryType,
  PlayerType,
  type ConfigEntry,
  type PlayerConfig,
} from "@/plugins/api/interfaces";
import EditPlayer from "@/views/settings/EditPlayer.vue";
import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    getDSPConfig: vi.fn(),
    getPlayerConfig: vi.fn(),
    getProviderManifest: vi.fn(),
    players: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, unknown>,
    providers: {} as Record<string, unknown>,
    savePlayerConfig: vi.fn(),
    subscribe: vi.fn(),
  },
  routerMock: {
    back: vi.fn(),
    push: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
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
    apiMock.getDSPConfig.mockResolvedValue({ enabled: false });
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig());
    apiMock.getProviderManifest.mockReturnValue({ domain: "chromecast" });
    apiMock.providerManifests = { chromecast: { name: "Chromecast" } };
    apiMock.players = {
      "player-1": {
        player_id: "player-1",
        type: PlayerType.PLAYER,
        supported_features: [],
        options: [],
        output_protocols: [],
        device_info: { manufacturer: "", model: "", identifiers: {} },
      },
    };
    apiMock.providers = {
      "hass--1": { instance_id: "hass--1", domain: "hass", available: true },
    };
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

function playerConfig(): PlayerConfig {
  return {
    player_id: "player-1",
    provider: "chromecast--1",
    enabled: true,
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

async function mountEditPlayer(): Promise<ConfigEntryUI[]> {
  const wrapper = shallowMount(EditPlayer, {
    props: { playerId: "player-1" },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper
    .findComponent({ name: "EditConfig" })
    .props("configEntries") as ConfigEntryUI[];
}
