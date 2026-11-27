import type { ContextMenuItem } from "@/helpers/context_menu_item";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { getPlayerSettingsMenuItems as buildPlayerSettingsMenuItems } from "@/helpers/player_settings_actions";
import {
  ChannelLayout,
  ConfigEntryType,
  EventType,
  PlayerType,
  ProtocolRole,
  ProviderFeature,
  ProviderType,
  SpeakerChannel,
  type ConfigEntry,
  type PlayerConfig,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import EditConfig from "@/views/settings/EditConfig.vue";
import EditPlayer from "@/views/settings/EditPlayer.vue";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  groupSettingsConfig,
  groupSettingsOutputs,
  playerSettingsConfig,
} from "../fixtures/playerSettingsConfig";
import { providerManifest } from "../fixtures/providerManifest";

const {
  apiMock,
  editConfigDiscardMock,
  editConfigResetMock,
  emitEvent,
  getPlayerSettingsMenuItems,
  isPlayerBeingRemoved,
  routerMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    getMultiChannelCandidates:
      vi.fn<MusicAssistantApi["getMultiChannelCandidates"]>(),
    getMultiChannelLayouts:
      vi.fn<MusicAssistantApi["getMultiChannelLayouts"]>(),
    getPlayerConfig: vi.fn<MusicAssistantApi["getPlayerConfig"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
    players: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, unknown>,
    providers: {} as Record<string, unknown>,
    savePlayerConfig: vi.fn<MusicAssistantApi["savePlayerConfig"]>(),
    serverInfo: { value: undefined as { server_version: string } | undefined },
    subscribe: vi.fn(),
  },
  editConfigDiscardMock: vi.fn(),
  editConfigResetMock: vi.fn(),
  emitEvent: vi.fn(),
  getPlayerSettingsMenuItems: vi.fn<typeof buildPlayerSettingsMenuItems>(),
  isPlayerBeingRemoved: vi.fn<(playerId: string) => boolean>(),
  routerMock: {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    // no page to go back to, so leaving the page takes the fallback route
    options: { history: { state: { back: null } } },
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

vi.mock("@/helpers/player_config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/player_config")>()),
  getPlayerName: (config: PlayerConfig) => config.name ?? config.default_name,
}));

// the shared menus are covered where they are built
vi.mock("@/helpers/player_settings_actions", () => ({
  getPlayerSettingsMenuItems,
  isPlayerBeingRemoved,
}));

vi.mock("@/plugins/store", () => ({
  store: {
    frameless: false,
    mobileLayout: false,
    roleScopes: {},
    currentUser: undefined,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return { ...actual, useRouter: () => routerMock };
});

// the entries of the player itself in the config of a Chromecast
const PLAYER_KEYS = [
  "hide_in_ui",
  "expose_player_to_ha",
  "play_media_overrides_group",
  "tts_pre_announce",
  "pre_announcement_chime_url",
];

// the layouts of the Sendspin provider, as the server lists them
const LAYOUTS = {
  [ChannelLayout.STEREO]: [
    SpeakerChannel.FRONT_LEFT,
    SpeakerChannel.FRONT_RIGHT,
  ],
};

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
    apiMock.serverInfo.value = undefined;
    routerMock.push.mockResolvedValue(undefined);
    // a fresh array per call, since the page appends its own entry to it
    getPlayerSettingsMenuItems.mockImplementation(() => [
      { label: "settings.delete" },
    ]);
    isPlayerBeingRemoved.mockReturnValue(false);
  });

  it("names the player in the header", async () => {
    const wrapper = await mountPlayerPage();

    expect(wrapper.get("h2").text()).toBe("Kitchen");
  });

  it("offers the setup in the header and leaves the advanced toggle to the form", async () => {
    const wrapper = await mountPlayerPage();

    expect(wrapper.get('[data-testid="player-setup"]').text()).toContain(
      "reconfigure_player",
    );
    expect(
      wrapper.findComponent({ name: "AdvancedSettingsToggle" }).exists(),
    ).toBe(false);
  });

  it("leaves the outputs and the player controls to their own pages", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(
      playerSettingsConfig({ player_id: "player-1" }),
    );

    const wrapper = await mountPlayerPage();

    expect(formKeys(wrapper)).toEqual(PLAYER_KEYS);
    expect(linkProps(wrapper)).toMatchObject({
      hasOutputs: true,
      hasControls: true,
    });
  });

  it("keeps the settings of a group, its members among them, on its own page", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(
      groupSettingsConfig({ player_id: "player-1" }),
    );
    apiMock.players = {
      "player-1": {
        ...playerState(),
        output_protocols: groupSettingsOutputs(),
        type: PlayerType.GROUP,
      },
    };

    const wrapper = await mountPlayerPage();

    expect(formKeys(wrapper)).toEqual([
      "hide_in_ui",
      "expose_player_to_ha",
      "preferred_output_protocol",
      "sgp_note",
      "group_members",
      "dynamic_members",
      "allowed_members",
      "dsp_note_multi_device_group_unsupported",
    ]);
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("outputProtocols"),
    ).toEqual(groupSettingsOutputs());
    expect(linkProps(wrapper)).toMatchObject({
      hasOutputs: false,
      hasControls: true,
    });
  });

  it("offers no row for a page that would only hold hidden entries", async () => {
    // a single output whose protocol is away leaves only the preferred output, hidden
    const config = playerSettingsConfig({ player_id: "player-1" });
    config.values = Object.fromEntries(
      Object.entries(config.values).filter(
        ([key, entry]) =>
          !entry.category.startsWith("protocol_") ||
          key === "preferred_output_protocol",
      ),
    );
    config.values.preferred_output_protocol.hidden = true;
    apiMock.getPlayerConfig.mockResolvedValue(config);

    const wrapper = await mountPlayerPage();

    expect(linkProps(wrapper)).toMatchObject({
      hasOutputs: false,
      hasControls: true,
    });
  });

  it("saves the entries of this page only, with whether the player is enabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(
      playerSettingsConfig({ player_id: "player-1" }),
    );
    const wrapper = await mountPlayerPage({ realForm: true });
    const form = wrapper.findComponent(EditConfig);

    await form.vm.submit();
    await flushPromises();

    const [playerId, values] = apiMock.savePlayerConfig.mock.lastCall!;
    expect(playerId).toBe("player-1");
    expect(Object.keys(values)).toEqual([...PLAYER_KEYS, "enabled"]);
    expect(values.enabled).toBe(true);
  });

  it("leaves whether advanced settings show to the user's choice in the form", async () => {
    const wrapper = await mountPlayerPage();

    expect(
      wrapper
        .findComponent({ name: "EditConfig" })
        .props("showAdvancedSettings"),
    ).toBeUndefined();
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

  it("links the player settings documentation", async () => {
    const wrapper = await mountPlayerPage();

    expect(
      wrapper.get('[data-testid="player-documentation"]').attributes(),
    ).toMatchObject({
      href: "https://music-assistant.io/settings/individual-player/",
      rel: "noopener noreferrer",
      target: "_blank",
    });
  });

  it("links the beta documentation from a beta server", async () => {
    apiMock.serverInfo.value = { server_version: "2.9.0b1" };

    const wrapper = await mountPlayerPage();

    expect(
      wrapper.get('[data-testid="player-documentation"]').attributes("href"),
    ).toBe("https://beta.music-assistant.io/settings/individual-player/");
  });

  it("keeps the documentation link without any setup action", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));

    const wrapper = await mountPlayerPage();

    expect(wrapper.find('[data-testid="player-setup"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="player-documentation"]').exists()).toBe(
      true,
    );
  });

  it("reports a player that cannot be reached", async () => {
    apiMock.players = { "player-1": playerState({ available: false }) };

    const wrapper = await mountPlayerPage();

    expect(wrapper.text()).toContain("settings.player_not_available");
  });

  it("says why the player needs setup", async () => {
    apiMock.players = {
      "player-1": playerState({
        available: false,
        needsSetup: true,
        setupReason: "pairing_required",
      }),
    };

    const wrapper = await mountPlayerPage();

    expect(wrapper.text()).toContain("settings.setup_reason.pairing_required");
    expect(wrapper.text()).not.toContain("settings.player_needs_setup");
  });

  it("calls a player whose provider is not installed not available", async () => {
    apiMock.players = {
      "player-1": playerState({
        available: false,
        setupReason: "provider_not_installed",
      }),
    };

    const wrapper = await mountPlayerPage();

    expect(wrapper.text()).toContain("settings.player_not_available");
    expect(wrapper.text()).not.toContain("provider_not_installed");
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

  it("shows what the server kept when enabling fails", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));
    apiMock.savePlayerConfig.mockRejectedValueOnce(
      new ApiCommandError("Enable failed", 1, "Enable failed"),
    );
    const wrapper = await mountPlayerPage();

    await wrapper.get(".v-btn").trigger("click");
    await flushPromises();

    expect(apiMock.getPlayerConfig).toHaveBeenCalledTimes(2);
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("disabled"),
    ).toBe(true);
    // the api toasts a refused save itself
    expect(toastMock.error).not.toHaveBeenCalled();
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

  it("hands the layouts the server lists to the page menu", async () => {
    apiMock.players = {
      "player-1": {
        ...playerState(),
        protocols: [
          {
            protocol_id: "client-1",
            domain: "sendspin",
            provider: "sendspin",
            role: ProtocolRole.NATIVE,
            available: true,
            active: false,
          },
        ],
      },
    };
    apiMock.getProvider.mockReturnValue({
      ...providerInstance(),
      supported_features: [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER],
    });
    apiMock.getMultiChannelCandidates.mockResolvedValue(["player-1"]);
    apiMock.getMultiChannelLayouts.mockResolvedValue(LAYOUTS);
    const wrapper = await mountPlayerPage();

    await wrapper.get('[data-testid="player-menu"]').trigger("click");

    // the menu of the page decides from them whether a subwoofer can join or go
    expect(getPlayerSettingsMenuItems.mock.lastCall?.[1]).toMatchObject({
      multiChannelLayouts: { sendspin: LAYOUTS },
    });
  });

  it("asks no config of a player a command of this app is removing", async () => {
    await mountPlayerPage();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledOnce();

    isPlayerBeingRemoved.mockImplementation((id) => id === "player-1");
    playerConfigUpdated("player-1");
    await flushPromises();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledOnce();

    // once the command is done, a change is fetched again
    isPlayerBeingRemoved.mockReturnValue(false);
    playerConfigUpdated("player-1");
    await flushPromises();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledTimes(2);
  });

  it("asks no config of a player the server removed", async () => {
    await mountPlayerPage();

    // another player going changes nothing for this page
    playerRemoved("player-2");
    playerConfigUpdated("player-1");
    await flushPromises();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledTimes(2);

    const player = apiMock.players["player-1"];
    delete apiMock.players["player-1"];
    playerRemoved("player-1");
    playerConfigUpdated("player-1");
    providersUpdated();
    await flushPromises();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledTimes(2);

    // a player that comes back has a config again
    apiMock.players["player-1"] = player;
    playerConfigUpdated("player-1");
    await flushPromises();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledTimes(3);
  });

  it("stays quiet when the player goes with its config while that refreshes", async () => {
    const wrapper = await mountPlayerPage();
    apiMock.getPlayerConfig.mockImplementationOnce(async () => {
      // the server removed the player before it answered
      delete apiMock.players["player-1"];
      throw new Error("No config found for player id player-1");
    });

    playerConfigUpdated("player-1");
    await flushPromises();

    const options = apiMock.getPlayerConfig.mock.lastCall?.[1];
    expect(
      (options?.suppressGlobalError as (() => boolean) | undefined)?.(),
    ).toBe(true);
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(wrapper.findComponent({ name: "EditConfig" }).exists()).toBe(true);
  });

  it("reports a refresh that fails while the player is still there", async () => {
    await mountPlayerPage();
    apiMock.getPlayerConfig.mockRejectedValueOnce(new Error("Server error"));

    playerConfigUpdated("player-1");
    await flushPromises();

    const options = apiMock.getPlayerConfig.mock.lastCall?.[1];
    expect(
      (options?.suppressGlobalError as (() => boolean) | undefined)?.(),
    ).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith("Error: Server error");
  });

  it("starts the form over from what is stored once a speaker joined or left", async () => {
    const wrapper = await mountPlayerPage();
    await wrapper.get('[data-testid="player-menu"]').trigger("click");

    getPlayerSettingsMenuItems.mock.calls[0][1]!.onSpeakersChanged!();
    await flushPromises();

    // the server numbers the speakers anew, so pending edits of a speaker go
    expect(editConfigDiscardMock).toHaveBeenCalledOnce();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledTimes(2);
    expect(wrapper.findComponent({ name: "EditConfig" }).exists()).toBe(true);
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
});

function providerInstance(): ProviderInstance {
  return {
    type: ProviderType.PLAYER,
    domain: "chromecast",
    instance_id: "chromecast--1",
    name: "Chromecast",
    available: true,
    is_streaming_provider: null,
    supported_features: [],
    supported_artist_types: [],
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
    player_type: PlayerType.PLAYER,
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
    },
  };
}

function playerState({
  available = true,
  hasSetupFlow = true,
  needsSetup = false,
  playerId = "player-1",
  setupReason = null,
}: {
  available?: boolean;
  hasSetupFlow?: boolean;
  needsSetup?: boolean;
  playerId?: string;
  setupReason?: string | null;
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
    protocols: [],
    setup_reason: setupReason,
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
function playerRemoved(playerId: string) {
  for (const [eventType, callback] of apiMock.subscribe.mock.calls) {
    if (eventType === EventType.PLAYER_REMOVED)
      callback({ object_id: playerId });
  }
}

function playerConfigUpdated(playerId: string) {
  for (const [eventType, callback] of apiMock.subscribe.mock.calls) {
    if (eventType === EventType.PLAYER_CONFIG_UPDATED) {
      callback({ object_id: playerId });
    }
  }
}

async function mountPlayerPage({ realForm = false } = {}) {
  const wrapper = shallowMount(EditPlayer, {
    props: { playerId: "player-1" },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        ...playerDetailsStubs,
        EditConfig: realForm ? false : playerDetailsStubs.EditConfig,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

/**
 * What the page tells its rows of the pages of their own.
 */
function linkProps(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "PlayerSettingsLinks" }).props();
}

/**
 * The keys of the entries the page hands its form, in order.
 */
function formKeys(wrapper: VueWrapper): string[] {
  return (
    wrapper
      .findComponent({ name: "EditConfig" })
      .props("configEntries") as ConfigEntryUI[]
  ).map((entry) => entry.key);
}
