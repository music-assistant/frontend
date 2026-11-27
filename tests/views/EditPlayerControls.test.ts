import {
  isHassControlPickerEntry,
  type ConfigEntryUI,
} from "@/helpers/config_entry_ui";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  PlayerType,
  type ConfigEntry,
} from "@/plugins/api/interfaces";
import EditConfig from "@/views/settings/EditConfig.vue";
import EditPlayerControls from "@/views/settings/EditPlayerControls.vue";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  playerSettingsConfig,
  playerSettingsOutputs,
} from "../fixtures/playerSettingsConfig";

const { apiMock, editConfigDiscardMock, isPlayerBeingRemoved, routerMock } =
  vi.hoisted(() => ({
    apiMock: {
      getPlayerConfig: vi.fn<MusicAssistantApi["getPlayerConfig"]>(),
      players: {} as Record<string, unknown>,
      providers: {} as Record<string, unknown>,
      savePlayerConfig: vi.fn<MusicAssistantApi["savePlayerConfig"]>(),
      serverInfo: {
        value: undefined as { server_version: string } | undefined,
      },
      subscribe: vi.fn(),
    },
    editConfigDiscardMock: vi.fn(),
    isPlayerBeingRemoved: vi.fn<(playerId: string) => boolean>(),
    routerMock: {
      back: vi.fn(),
      push: vi.fn(),
      replace: vi.fn(),
      // no page to go back to, so leaving the page takes the fallback route
      options: { history: { state: { back: null } } },
    },
  }));

const EditConfigStub = {
  name: "EditConfig",
  props: ["configEntries", "disabled"],
  methods: { discardChanges: editConfigDiscardMock },
  template: "<div />",
};

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/plugins/store", () => ({
  store: {
    frameless: false,
    mobileLayout: false,
    roleScopes: {},
    currentUser: undefined,
  },
}));

vi.mock("@/helpers/player_settings_actions", () => ({
  isPlayerBeingRemoved,
}));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return { ...actual, useRouter: () => routerMock };
});

const CONTROL_KEYS = [
  "power_control",
  "volume_control",
  "mute_control",
  "min_volume",
  "max_volume",
  "auto_play",
];
// the entries a Home Assistant entity can stand in for
const PICKED_KEYS = ["power_control", "volume_control", "mute_control"];

describe("EditPlayerControls", () => {
  // the api mock is a module singleton, so a component left mounted keeps
  // answering the next test's events
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.subscribe.mockReturnValue(vi.fn());
    apiMock.getPlayerConfig.mockResolvedValue(playerSettingsConfig());
    apiMock.savePlayerConfig.mockResolvedValue(playerSettingsConfig());
    apiMock.players = { kitchen: playerState() };
    apiMock.providers = {
      "hass--1": { instance_id: "hass--1", domain: "hass", available: true },
    };
    apiMock.serverInfo.value = undefined;
    isPlayerBeingRemoved.mockReturnValue(false);
  });

  it("names the player in the header and links the docs of the player controls", async () => {
    const header = (await mountPage()).findComponent({
      name: "SettingsHeaderCard",
    });

    expect(header.props()).toMatchObject({
      title: "settings.category.player_controls",
      description: "Kitchen",
      documentationUrl:
        "https://music-assistant.io/settings/individual-player/#player-controls",
      resetDisabled: false,
    });
  });

  it("keeps the reset out of reach while the player is disabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(
      playerSettingsConfig({ enabled: false }),
    );

    const header = (await mountPage()).findComponent({
      name: "SettingsHeaderCard",
    });

    expect(header.props("resetDisabled")).toBe(true);
  });

  it("shows the player controls only, with the entity picker under each control entry", async () => {
    const keys = formEntries(await mountPage()).map((entry) => entry.key);

    expect(keys.filter((key) => !key.endsWith("_hass_control_picker"))).toEqual(
      CONTROL_KEYS,
    );
    for (const controlKey of PICKED_KEYS) {
      expect(keys[keys.indexOf(controlKey) + 1]).toBe(
        `${controlKey}_hass_control_picker`,
      );
    }
  });

  it("points each picker at the control list that registers its entity", async () => {
    const pickers = formEntries(await mountPage()).filter(
      isHassControlPickerEntry,
    );

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

    const entries = formEntries(await mountPage());

    expect(entries.some(isHassControlPickerEntry)).toBe(false);
  });

  it("leaves the picker out without a Home Assistant provider", async () => {
    apiMock.providers = {};

    const entries = formEntries(await mountPage());

    expect(entries.some(isHassControlPickerEntry)).toBe(false);
  });

  it("saves the player controls only and goes back to the player", async () => {
    const wrapper = await mountPage({ realForm: true });
    const form = wrapper.findComponent(EditConfig);
    // what a picked entity leaves behind, waiting for the save
    formEntry(form, "power_control").value = "switch.kitchen_amp";

    await form.vm.submit();
    await flushPromises();

    const [playerId, values] = apiMock.savePlayerConfig.mock.lastCall!;
    expect(playerId).toBe("kitchen");
    expect(Object.keys(values)).toEqual(CONTROL_KEYS);
    expect(values.power_control).toBe("switch.kitchen_amp");
    expect(routerMock.push).toHaveBeenCalledWith({
      name: "editplayer",
      params: { playerId: "kitchen" },
    });
  });

  it("leaves to the players list once the server removed the player", async () => {
    await mountPage();

    playerRemoved("kitchen");

    // pending edits have nothing left to save to
    expect(editConfigDiscardMock).toHaveBeenCalledOnce();
    expect(routerMock.replace).toHaveBeenCalledWith({ name: "playersettings" });
  });
});

function playerState() {
  return {
    available: true,
    device_info: { manufacturer: "", model: "", identifiers: {} },
    enabled: true,
    name: "Kitchen",
    options: [],
    output_protocols: playerSettingsOutputs(),
    player_id: "kitchen",
    protocols: [],
    supported_features: [],
    type: PlayerType.PLAYER,
  };
}

function formEntries(wrapper: VueWrapper): ConfigEntryUI[] {
  return wrapper
    .findComponent({ name: "EditConfig" })
    .props("configEntries") as ConfigEntryUI[];
}

function formEntry(
  form: { props(name: "configEntries"): unknown },
  key: string,
): ConfigEntry {
  const found = (form.props("configEntries") as ConfigEntry[]).find(
    (entry) => entry.key === key,
  );
  if (!found) throw new Error(`The form has no ${key} entry`);
  return found;
}

function playerRemoved(playerId: string) {
  for (const [eventType, callback] of apiMock.subscribe.mock.calls) {
    if (eventType === EventType.PLAYER_REMOVED) {
      callback({ object_id: playerId });
    }
  }
}

async function mountPage({ realForm = false } = {}) {
  const wrapper = shallowMount(EditPlayerControls, {
    props: { playerId: "kitchen" },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { EditConfig: realForm ? false : EditConfigStub },
    },
  });
  await flushPromises();
  return wrapper;
}
