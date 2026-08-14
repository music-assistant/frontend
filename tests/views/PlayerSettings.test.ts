import type { MusicAssistantApi } from "@/plugins/api";
import type {
  getPlayerSettingsMenuItems as buildPlayerSettingsMenuItems,
  getPlayerSettingsSections as readPlayerSettingsSections,
} from "@/helpers/player_settings_actions";
import { EventType, type PlayerConfig } from "@/plugins/api/interfaces";
import PlayerSettings from "@/views/settings/PlayerSettings.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  emitEvent,
  getPlayerSettingsMenuItems,
  getPlayerSettingsSections,
  goBack,
  routeMock,
  routerMock,
  toastMock,
} = await vi.hoisted(async () => {
  // a real reactive route, so the tab strip follows it the way it does in the app
  const { reactive } = await import("vue");
  return {
    apiMock: {
      getPlayerConfig: vi.fn<MusicAssistantApi["getPlayerConfig"]>(),
      getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
      players: {} as Record<string, unknown>,
      savePlayerConfig: vi.fn<MusicAssistantApi["savePlayerConfig"]>(),
      subscribe: vi.fn(),
    },
    emitEvent: vi.fn(),
    getPlayerSettingsMenuItems: vi.fn<typeof buildPlayerSettingsMenuItems>(),
    getPlayerSettingsSections: vi.fn<typeof readPlayerSettingsSections>(),
    goBack: vi.fn(),
    routeMock: reactive({
      name: "editplayer" as string,
      params: { playerId: "kitchen" } as Record<string, string>,
    }),
    routerMock: {
      back: vi.fn(),
      push: vi.fn(),
    },
    toastMock: {
      error: vi.fn(),
      success: vi.fn(),
    },
  };
});

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    emit: emitEvent,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

// the menu and the section rules are covered where they are built
vi.mock("@/helpers/player_settings_actions", () => ({
  getPlayerName: (config: PlayerConfig) => config.name ?? config.default_name,
  getPlayerSettingsMenuItems,
  getPlayerSettingsSections,
}));

vi.mock("@/helpers/navigation", () => ({
  goBack,
}));

vi.mock("@/helpers/utils", () => ({
  openLinkInNewTab: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeMock,
  useRouter: () => routerMock,
}));

const passthroughStub = { template: "<div><slot /></div>" };
const ButtonStub = { template: "<button><slot /></button>" };

const TAB_LABELS = [
  "settings.player_settings",
  "settings.queue_settings",
  "DSP",
  "settings.category.options",
];

describe("PlayerSettings", () => {
  // the api mock is a module singleton, so a page left mounted keeps answering
  // the next test's config updates
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    routeMock.name = "editplayer";
    apiMock.subscribe.mockReturnValue(vi.fn());
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig());
    apiMock.savePlayerConfig.mockResolvedValue(playerConfig());
    apiMock.players = { kitchen: player() };
    getPlayerSettingsSections.mockReturnValue({
      player: true,
      queue: true,
      dsp: true,
      options: true,
    });
    getPlayerSettingsMenuItems.mockReturnValue([{ label: "settings.delete" }]);
  });

  it("lists a tab for every section the player has", async () => {
    const wrapper = await mountPlayerSettings();

    expect(tabLabels(wrapper)).toEqual(TAB_LABELS);
  });

  it("leaves the tab strip out when only the player settings apply", async () => {
    getPlayerSettingsSections.mockReturnValue({
      player: true,
      queue: false,
      dsp: false,
      options: false,
    });

    const wrapper = await mountPlayerSettings();

    expect(tabLabels(wrapper)).toEqual([]);
  });

  it("leaves out the sections the player has nothing to show for", async () => {
    getPlayerSettingsSections.mockReturnValue({
      player: true,
      queue: false,
      dsp: true,
      options: false,
    });

    const wrapper = await mountPlayerSettings();

    expect(tabLabels(wrapper)).toEqual(["settings.player_settings", "DSP"]);
  });

  it("marks the tab the route landed on", async () => {
    routeMock.name = "editplayerdsp";

    const wrapper = await mountPlayerSettings();

    expect(activeTab(wrapper)).toBe("DSP");
  });

  it("keeps the active tab on the route a blocked navigation stayed on", async () => {
    const wrapper = await mountPlayerSettings();

    await selectTab(wrapper, "settings.queue_settings");

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "editplayerqueue",
      params: { playerId: "kitchen" },
    });
    // the form under the strip can refuse to leave, so nothing moves until the
    // route itself does
    expect(activeTab(wrapper)).toBe("settings.player_settings");

    routeMock.name = "editplayerqueue";
    await flushPromises();

    expect(activeTab(wrapper)).toBe("settings.queue_settings");
  });

  it("opens the shared player menu from the kebab", async () => {
    const wrapper = await mountPlayerSettings();

    await wrapper
      .get('[data-testid="player-menu"]')
      .trigger("click", { clientX: 10, clientY: 20 });

    expect(getPlayerSettingsMenuItems).toHaveBeenCalledWith(
      expect.objectContaining({ player_id: "kitchen" }),
      expect.objectContaining({ onDeleted: expect.any(Function) }),
    );
    expect(emitEvent).toHaveBeenCalledWith("contextmenu", {
      items: [{ label: "settings.delete" }],
      posX: 10,
      posY: 20,
    });
  });

  it("leaves the settings page once the player is deleted", async () => {
    const wrapper = await mountPlayerSettings();
    await wrapper.get('[data-testid="player-menu"]').trigger("click");

    getPlayerSettingsMenuItems.mock.calls[0][1]!.onDeleted!();

    expect(goBack).toHaveBeenCalledWith(routerMock, { name: "playersettings" });
  });

  it("renames the player from the header", async () => {
    const wrapper = await mountPlayerSettings();

    await wrapper.get('[title="settings.player_name"]').trigger("click");

    expect(emitEvent).toHaveBeenCalledWith("playerRenameDialog", {
      playerId: "kitchen",
      name: "Kitchen",
      defaultName: "Chromecast",
    });
  });

  it("picks a rename made elsewhere up from the server", async () => {
    const wrapper = await mountPlayerSettings();
    expect(wrapper.text()).toContain("Kitchen");
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ name: "Lounge" }));

    playerConfigUpdated("kitchen");
    await flushPromises();

    expect(wrapper.text()).toContain("Lounge");
  });

  it("offers to enable a disabled player", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));
    const wrapper = await mountPlayerSettings();
    expect(wrapper.text()).toContain("settings.player_disabled");

    await wrapper.get(".v-btn").trigger("click");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      enabled: true,
    });
    expect(toastMock.success).toHaveBeenCalledWith("settings.player_saved");
    expect(wrapper.text()).not.toContain("settings.player_disabled");
  });

  it("asks for the setup a player still needs", async () => {
    apiMock.players = { kitchen: player({ needs_setup: true }) };
    const wrapper = await mountPlayerSettings();

    expect(wrapper.text()).toContain("settings.player_needs_setup");
    expect(wrapper.get('[data-testid="player-setup"]').text()).toContain(
      "configure_player",
    );

    await wrapper.get('[data-testid="player-setup"]').trigger("click");

    expect(emitEvent).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "player",
      playerId: "kitchen",
    });
  });

  it("reports a player that cannot be reached", async () => {
    apiMock.players = { kitchen: player({ available: false }) };
    const wrapper = await mountPlayerSettings();

    expect(wrapper.text()).toContain("settings.player_not_available");
  });

  it("offers to run the setup again for a player that is fine", async () => {
    const wrapper = await mountPlayerSettings();

    expect(wrapper.text()).not.toContain("settings.player_disabled");
    expect(wrapper.text()).not.toContain("settings.player_needs_setup");
    expect(wrapper.text()).not.toContain("settings.player_not_available");
    expect(wrapper.get('[data-testid="player-setup"]').text()).toContain(
      "reconfigure_player",
    );
  });

  it("keeps the setup out of reach while the player is disabled", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(playerConfig({ enabled: false }));

    const wrapper = await mountPlayerSettings();

    expect(wrapper.find('[data-testid="player-setup"]').exists()).toBe(false);
  });
});

type PlayerSettingsWrapper = Awaited<ReturnType<typeof mountPlayerSettings>>;

function tabLabels(wrapper: PlayerSettingsWrapper): string[] {
  return wrapper.findAll('[role="tab"]').map((tab) => tab.text());
}

function activeTab(wrapper: PlayerSettingsWrapper): string | undefined {
  return wrapper
    .findAll('[role="tab"]')
    .find((tab) => tab.attributes("data-state") === "active")
    ?.text();
}

/**
 * Pick a tab the way a user does: reka switches on mousedown, not on click.
 */
async function selectTab(wrapper: PlayerSettingsWrapper, label: string) {
  const tab = wrapper.findAll('[role="tab"]').find((it) => it.text() === label);
  if (!tab) throw new Error(`The tab strip has no "${label}" tab`);
  await tab.trigger("mousedown", { button: 0 });
  await flushPromises();
}

/**
 * Deliver the server-side config change the page listens for.
 */
function playerConfigUpdated(playerId: string) {
  for (const [eventType, callback] of apiMock.subscribe.mock.calls) {
    if (eventType === EventType.PLAYER_CONFIG_UPDATED) {
      callback({ object_id: playerId });
    }
  }
}

function playerConfig(overrides: Partial<PlayerConfig> = {}): PlayerConfig {
  return {
    player_id: "kitchen",
    provider: "chromecast--1",
    enabled: true,
    name: "Kitchen",
    default_name: "Chromecast",
    values: {},
    ...overrides,
  };
}

function player(overrides: Record<string, unknown> = {}) {
  return {
    player_id: "kitchen",
    name: "Kitchen",
    available: true,
    device_info: { manufacturer: "", model: "", identifiers: {} },
    enabled: true,
    has_setup_flow: true,
    needs_setup: false,
    options: [],
    output_protocols: [],
    ...overrides,
  };
}

async function mountPlayerSettings(playerId = "kitchen") {
  const wrapper = mount(PlayerSettings, {
    props: { playerId },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Button: ButtonStub,
        Card: passthroughStub,
        CardContent: passthroughStub,
        CardHeader: passthroughStub,
        PlayerIcon: true,
        ProviderIcon: true,
        RouterView: true,
        VAlert: passthroughStub,
        VBtn: { template: '<button class="v-btn"><slot /></button>' },
        VChip: passthroughStub,
        VIcon: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
