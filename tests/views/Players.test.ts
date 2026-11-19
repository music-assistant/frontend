import SettingsListPanel, {
  type SettingsPanelAction,
} from "@/components/settings/SettingsListPanel.vue";
import Players from "@/views/settings/Players.vue";
import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type {
  getPlayerSettingsMenuItems as buildPlayerSettingsMenuItems,
  removeUnavailablePlayers as removeUnavailable,
} from "@/helpers/player_settings_actions";
import {
  PlayerType,
  ProviderFeature,
  ProviderType,
  Scope,
  type PlayerConfig,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { webPlayer } from "@/plugins/web_player";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerInstance } from "../fixtures/providerInstance";
import { providerManifest } from "../fixtures/providerManifest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const {
  apiMock,
  emitEvent,
  getPlayerSettingsMenuItems,
  hasScope,
  preferences,
  removeUnavailablePlayers,
  routerPush,
  setPreference,
  pageMenu,
} = vi.hoisted(() => ({
  apiMock: {
    getPlayerConfigs: vi.fn<MusicAssistantApi["getPlayerConfigs"]>(),
    getProvider: vi.fn<MusicAssistantApi["getProvider"]>(),
    getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(),
    playerManifests: {},
    players: {} as Record<
      string,
      {
        player_id: string;
        available: boolean;
        needs_setup: boolean;
        output_protocols: [];
      }
    >,
    providerManifests: {},
    providers: {} as Record<string, ProviderInstance>,
    subscribe_multi: vi.fn(),
  },
  emitEvent: vi.fn(),
  getPlayerSettingsMenuItems: vi.fn<typeof buildPlayerSettingsMenuItems>(),
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  // the preferences the page reads, by key
  preferences: {} as Record<string, unknown>,
  removeUnavailablePlayers: vi.fn<typeof removeUnavailable>(),
  routerPush: vi.fn(),
  setPreference: vi.fn(),
  // what the page publishes into the menu in the header of the page
  pageMenu: { value: [] as ToolBarMenuItem[] },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    emit: emitEvent,
  },
}));

vi.mock("@/helpers/player_config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/player_config")>()),
  getPlayerName: (config: PlayerConfig) => config.name ?? config.player_id,
}));

// the menu itself is covered where it is built; here it only has to arrive
vi.mock("@/helpers/player_settings_actions", () => ({
  getPlayerSettingsMenuItems,
  removeUnavailablePlayers,
}));

vi.mock("@/composables/useSettingsPageMenu", () => ({
  useSettingsPageMenu: () => pageMenu,
}));

vi.mock("@/composables/userPreferences", async () => {
  const { computed, reactive } =
    await vi.importActual<typeof import("vue")>("vue");
  const values = reactive(preferences);
  return {
    useUserPreferences: () => ({
      getPreference: (key: string, defaultValue: unknown) =>
        computed(() => values[key] ?? defaultValue),
      setPreference: (key: string, value: unknown) => {
        setPreference(key, value);
        values[key] = value;
      },
    }),
  };
});

vi.mock("@/helpers/utils", () => ({
  openLinkInNewTab: vi.fn(),
}));

vi.mock("@/views/settings/AddPlayerGroupDialog.vue", () => ({
  default: {
    template: "<div />",
  },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

const playerConfig = {
  enabled: true,
  name: "Kitchen",
  default_name: null,
  player_id: "kitchen",
  provider: "test",
  player_type: PlayerType.PLAYER,
  values: {},
};

const SettingsPlayerCardStub = {
  props: ["playerConfig"],
  emits: ["click", "menu", "setup"],
  template: `
    <button
      class="settings-player-card"
      @click="$emit('click', playerConfig)"
    />
  `,
};

const passthroughStub = {
  template: "<div><slot /></div>",
};

const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

describe("Players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    for (const key of Object.keys(preferences)) delete preferences[key];
    pageMenu.value = [];
    playerConfig.enabled = true;
    webPlayer.player_id = null;
    apiMock.players = {
      kitchen: {
        player_id: "kitchen",
        available: false,
        needs_setup: true,
        output_protocols: [],
      },
    };
    apiMock.getPlayerConfigs.mockResolvedValue([playerConfig]);
    apiMock.getProvider.mockReturnValue({
      type: ProviderType.PLAYER,
      domain: "test",
      name: "Test",
      instance_id: "test",
      supported_features: [],
      supported_artist_types: [],
      available: true,
      is_streaming_provider: null,
    });
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
    apiMock.providers = {};
    apiMock.subscribe_multi.mockReturnValue(vi.fn());
    getPlayerSettingsMenuItems.mockReturnValue([{ label: "settings.delete" }]);
  });

  it("leads an admin to the playback defaults and to the player support, saying how many run", async () => {
    apiMock.providers = {
      "sonos--1": providerInstance({
        instance_id: "sonos--1",
        type: ProviderType.PLAYER,
      }),
      "airplay--1": providerInstance({
        instance_id: "airplay--1",
        type: ProviderType.PLAYER,
      }),
      "spotify--1": providerInstance({
        instance_id: "spotify--1",
        type: ProviderType.MUSIC,
      }),
    };
    const wrapper = await mountPlayers("list");

    expect(linkRowKeys(wrapper)).toEqual(["playback", "player_support"]);
    const support = wrapper.get(
      '[data-testid="settings-page-link-player_support"]',
    );
    expect(JSON.parse(support.attributes("href")!)).toEqual({
      name: "playerproviders",
    });
    expect(support.get('[data-testid="settings-page-state"]').text()).toBe(
      "2 active",
    );
  });

  it.each([
    {
      role: "a role that only changes player settings",
      scopes: [...BUILTIN_ROLE_SCOPES.guest, Scope.CONFIG_PLAYERS_WRITE],
      rows: [],
    },
    {
      role: "a role that changes player and server settings",
      scopes: [
        ...BUILTIN_ROLE_SCOPES.guest,
        Scope.CONFIG_PLAYERS_WRITE,
        Scope.CONFIG_CORE_WRITE,
      ],
      rows: ["playback"],
    },
  ])("leads $role only where it may go", async ({ scopes, rows }) => {
    hasScope.mockImplementation(scopeChecker(scopes));
    const wrapper = await mountPlayers("list");

    expect(linkRowKeys(wrapper)).toEqual(rows);
  });

  it("heads the page as the Players hub", async () => {
    const wrapper = await mountPlayers("list");

    const header = wrapper.get('[data-testid="settings-page-header"]');
    expect(header.get("h1").text()).toBe("Players");
    expect(header.get("p").text()).toBe(
      "Your players, lights, screens and audio inputs, and how they play",
    );
  });

  it.each(["list", "card"] as const)(
    "lists the players first and every other kind of device under a heading of its own in %s view",
    async (viewMode) => {
      apiMock.getPlayerConfigs.mockResolvedValue(DEVICES);
      const wrapper = await mountPlayers(viewMode);

      expect(
        wrapper.findAll('[data-testid="player-section"]').map((section) => ({
          key: section.attributes("data-section"),
          heading: section.find("h3").exists()
            ? section.get("h3").text()
            : undefined,
          players: section.findAll(PLAYER_SELECTORS[viewMode]).length,
        })),
      ).toEqual([
        { key: "players", heading: undefined, players: 1 },
        { key: "lights", heading: "Lights", players: 1 },
        { key: "screens", heading: "Screens", players: 1 },
        { key: "inputs", heading: "Audio inputs", players: 1 },
      ]);
    },
  );

  it("lists every kind of device in the one list of the players, counting them all", async () => {
    apiMock.getPlayerConfigs.mockResolvedValue(DEVICES);
    const wrapper = await mountPlayers("list");

    const panel = wrapper.get('[data-testid="player-list"]');
    expect(panel.get("h2").text()).toBe("Players 4");
    expect(panel.findAll('[data-testid="player-section"]')).toHaveLength(4);
    expect(panel.findComponent({ name: "PlayerFilters" }).exists()).toBe(true);
  });

  it("splits what the filters leave into sections", async () => {
    apiMock.getPlayerConfigs.mockResolvedValue(DEVICES);
    const wrapper = await mountPlayers("list");
    const filters = wrapper.findComponent({ name: "PlayerFilters" });

    filters.vm.$emit("update:types", [PlayerType.LIGHT, PlayerType.SOURCE]);
    await flushPromises();

    expect(sectionKeys(wrapper)).toEqual(["lights", "inputs"]);

    filters.vm.$emit("update:types", [PlayerType.LIGHT]);
    await flushPromises();

    expect(sectionKeys(wrapper)).toEqual(["lights"]);
    expect(wrapper.get('[data-testid="player-section"] h3').text()).toBe(
      "Lights",
    );
  });

  it("offers to add a group player from the list when a provider makes them", async () => {
    apiMock.providers = {
      "sonos--1": providerInstance({
        domain: "sonos",
        instance_id: "sonos--1",
        type: ProviderType.PLAYER,
        supported_features: [ProviderFeature.CREATE_GROUP_PLAYER],
      }),
    };
    const wrapper = await mountPlayers("list");

    const actions = wrapper
      .getComponent(SettingsListPanel)
      .props("actions") as SettingsPanelAction[];
    expect(actions.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "add-player-group", label: "Add group player" },
    ]);
  });

  it("offers no group player without a provider making them", async () => {
    const wrapper = await mountPlayers("list");

    expect(wrapper.getComponent(SettingsListPanel).props("actions")).toEqual(
      [],
    );
  });

  it("switches the view from the header of the list", async () => {
    const toggleViewMode = vi.fn();
    const wrapper = await mountPlayers("card", toggleViewMode);

    const panel = wrapper.getComponent(SettingsListPanel);
    expect(panel.props("viewMode")).toBe("card");
    panel.vm.$emit("toggle-view-mode");

    expect(toggleViewMode).toHaveBeenCalledOnce();
  });

  it("points an admin to the player providers", async () => {
    const wrapper = await mountPlayers("list");

    expect(wrapper.find(".missing-players-hint").exists()).toBe(true);
  });

  it.each([
    { role: "a member", scopes: BUILTIN_ROLE_SCOPES.user },
    { role: "a guest", scopes: BUILTIN_ROLE_SCOPES.guest },
    {
      role: "a role that only changes player settings",
      scopes: [...BUILTIN_ROLE_SCOPES.guest, Scope.CONFIG_PLAYERS_WRITE],
    },
  ])("leaves the player providers out for $role", async ({ scopes }) => {
    hasScope.mockImplementation(scopeChecker(scopes));
    const wrapper = await mountPlayers("list");

    expect(wrapper.find(".missing-players-hint").exists()).toBe(false);
  });

  it.each([
    ["list", ".player-row"],
    ["card", ".settings-player-card"],
  ] as const)(
    "starts setup when clicking a setup-required player in %s view",
    async (viewMode, selector) => {
      const wrapper = await mountPlayers(viewMode);

      await wrapper.get(selector).trigger("click");

      expect(routerPush).not.toHaveBeenCalled();
      expect(emitEvent).toHaveBeenCalledWith("setupFlowDialog", {
        kind: "player",
        playerId: "kitchen",
      });
    },
  );

  it("opens settings when clicking a configured player", async () => {
    apiMock.players.kitchen.needs_setup = false;
    apiMock.players.kitchen.available = true;
    const wrapper = await mountPlayers("list");

    await wrapper.get(".player-row").trigger("click");

    expect(emitEvent).not.toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.anything(),
    );
    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
  });

  it("opens the settings of a player whose provider is not running", async () => {
    apiMock.players.kitchen.needs_setup = false;
    apiMock.getProvider.mockReturnValue(undefined);
    const wrapper = await mountPlayers("list");

    await wrapper.get(".player-row").trigger("click");

    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
  });

  it("opens settings when a setup-required player is disabled", async () => {
    playerConfig.enabled = false;
    const wrapper = await mountPlayers("list");

    await wrapper.get(".player-row").trigger("click");

    expect(emitEvent).not.toHaveBeenCalledWith(
      "setupFlowDialog",
      expect.anything(),
    );
    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
  });

  it("opens a player from its name, a button the keyboard can reach", async () => {
    apiMock.players.kitchen.needs_setup = false;
    apiMock.players.kitchen.available = true;
    const wrapper = await mountPlayers("list");
    const name = wrapper.get('.player-row [data-testid="player-open"]');

    expect(name.element.tagName).toBe("BUTTON");
    await name.trigger("click");

    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
  });

  it("opens the shared player menu with links to the settings sections", async () => {
    const wrapper = await mountPlayers("list");

    await wrapper.get(".player-row").trigger("contextmenu", { button: 2 });

    expect(getPlayerSettingsMenuItems).toHaveBeenCalledWith(
      expect.objectContaining({ player_id: "kitchen" }),
      expect.objectContaining({ includeSections: true }),
    );
    expect(emitEvent).toHaveBeenCalledWith(
      "contextmenu",
      expect.objectContaining({ items: [{ label: "settings.delete" }] }),
    );
  });

  it("opens the menu at the touch position for a long-press", async () => {
    const wrapper = await mountPlayers("list");

    await wrapper.get(".player-row").trigger("contextmenu", {
      button: 2,
      touches: [{ clientX: 11, clientY: 22 }],
    });

    expect(emitEvent).toHaveBeenCalledWith(
      "contextmenu",
      expect.objectContaining({ posX: 11, posY: 22 }),
    );
  });

  it("labels the player of this device next to its real name", async () => {
    webPlayer.player_id = "kitchen";
    const wrapper = await mountPlayers("list");
    const row = wrapper.get(".player-row");

    expect(row.text()).toContain("Kitchen");
    expect(row.get(".player-device-badge-label").text()).toBe("this_device");
  });

  it("does not label the player of another device", async () => {
    const wrapper = await mountPlayers("list");

    expect(wrapper.find(".player-device-badge").exists()).toBe(false);
  });

  it("filters the list by player status", async () => {
    const wrapper = await mountPlayers("list");
    const filters = wrapper.findComponent({ name: "PlayerFilters" });

    filters.vm.$emit("update:statuses", ["needs_setup"]);
    await flushPromises();
    expect(wrapper.find(".player-row").exists()).toBe(true);

    filters.vm.$emit("update:statuses", ["available"]);
    await flushPromises();
    expect(wrapper.find(".player-row").exists()).toBe(false);
  });

  it("offers to remove the unavailable players in the page menu to who may change player settings", async () => {
    const offersRemoval = async () => {
      const wrapper = await mountPlayers("list");
      const offered = !!pageMenuItem(REMOVE_UNAVAILABLE);
      wrapper.unmount();
      return offered;
    };

    expect(await offersRemoval()).toBe(true);

    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    expect(await offersRemoval()).toBe(false);
  });

  it("drops the players the server removed from the list", async () => {
    const wrapper = await mountPlayers("list");

    pageMenuItem(REMOVE_UNAVAILABLE)!.action!();
    expect(removeUnavailablePlayers).toHaveBeenCalledOnce();

    removeUnavailablePlayers.mock.calls[0][1]!(["kitchen"]);
    await flushPromises();
    expect(wrapper.find(".player-row").exists()).toBe(false);
  });

  it("takes its items out of the page menu when it closes", async () => {
    const wrapper = await mountPlayers("list");
    expect(pageMenu.value).not.toEqual([]);

    wrapper.unmount();

    expect(pageMenu.value).toEqual([]);
  });

  it("shows every player until unavailable players are hidden", async () => {
    // attic is disabled, so it has no player
    apiMock.players = {
      kitchen: unavailablePlayer("kitchen"),
      office: { ...unavailablePlayer("office"), needs_setup: true },
      garden: { ...unavailablePlayer("garden"), available: true },
    };
    apiMock.getPlayerConfigs.mockResolvedValue(
      ["kitchen", "attic", "office", "garden"].map((playerId) => ({
        ...playerConfig,
        player_id: playerId,
        name: playerId,
        enabled: playerId !== "attic",
      })),
    );
    const wrapper = await mountPlayers("list");
    const listed = () =>
      wrapper.findAll('[data-testid="player-open"]').map((name) => name.text());

    expect(pageMenuItem(HIDE_UNAVAILABLE)!.active).toBe(false);
    expect(listed()).toHaveLength(4);

    pageMenuItem(HIDE_UNAVAILABLE)!.action!();
    await flushPromises();

    expect(setPreference).toHaveBeenCalledWith(
      "settings.players.hideUnavailable",
      true,
    );
    expect(pageMenuItem(HIDE_UNAVAILABLE)!.active).toBe(true);
    expect(listed()).toEqual(["attic", "garden", "office"]);

    // the server decides what goes, so the hidden players are not left out,
    // and the confirmation names them as the list does, in its order
    pageMenuItem(REMOVE_UNAVAILABLE)!.action!();
    expect(removeUnavailablePlayers).toHaveBeenCalledOnce();
    expect(
      removeUnavailablePlayers.mock.calls[0][0].map((config) => config.name),
    ).toEqual(["attic", "garden", "kitchen", "office"]);
  });

  it("hides unavailable players when that was chosen before", async () => {
    preferences["settings.players.hideUnavailable"] = true;
    apiMock.players = { kitchen: unavailablePlayer("kitchen") };

    const wrapper = await mountPlayers("list");

    expect(wrapper.find(".player-row").exists()).toBe(false);
    expect(wrapper.find('[data-testid="players-empty"]').exists()).toBe(true);
  });

  it("drops a deleted player from the list", async () => {
    const wrapper = await mountPlayers("list");
    await wrapper.get(".player-row").trigger("contextmenu", { button: 2 });

    getPlayerSettingsMenuItems.mock.calls[0][1]!.onDeleted!();
    await flushPromises();

    expect(wrapper.find(".player-row").exists()).toBe(false);
  });
});

// a device of each kind; only the kitchen player is registered, the others
// go by the type their config holds
const DEVICES: PlayerConfig[] = [
  { ...playerConfig },
  {
    ...playerConfig,
    player_id: "lamp",
    name: "Lamp",
    player_type: PlayerType.LIGHT,
  },
  {
    ...playerConfig,
    player_id: "tv",
    name: "TV",
    player_type: PlayerType.DISPLAY,
  },
  {
    ...playerConfig,
    player_id: "mic",
    name: "Mic",
    player_type: PlayerType.SOURCE,
  },
];

const PLAYER_SELECTORS = {
  list: ".player-row",
  card: ".settings-player-card",
} as const;

const REMOVE_UNAVAILABLE = "settings.remove_unavailable_players";
const HIDE_UNAVAILABLE = "settings.hide_unavailable_players";

/** The item with this label in what the page publishes into the page menu. */
function pageMenuItem(label: string): ToolBarMenuItem | undefined {
  return pageMenu.value.find((item) => item.label === label);
}

function linkRowKeys(wrapper: Awaited<ReturnType<typeof mountPlayers>>) {
  return wrapper
    .findAll('[data-testid^="settings-page-link-"]')
    .map((row) =>
      row.attributes("data-testid")!.replace("settings-page-link-", ""),
    );
}

function sectionKeys(wrapper: Awaited<ReturnType<typeof mountPlayers>>) {
  return wrapper
    .findAll('[data-testid="player-section"]')
    .map((section) => section.attributes("data-section"));
}

function unavailablePlayer(playerId: string) {
  return {
    player_id: playerId,
    available: false,
    needs_setup: false,
    output_protocols: [] as [],
  };
}

async function mountPlayers(
  viewMode: "list" | "card",
  toggleViewMode = vi.fn(),
) {
  const wrapper = mount(Players, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      // the long-press directive is registered by a plugin the test skips
      directives: { hold: {} },
      provide: {
        playersViewMode: {
          toggleViewMode,
          viewMode: ref(viewMode),
        },
      },
      stubs: {
        AddPlayerGroupDialog: true,
        Button: true,
        Container: passthroughStub,
        PlayerFilters: true,
        PlayerIcon: true,
        RouterLink: RouterLinkStub,
        SettingsPlayerCard: SettingsPlayerCardStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
