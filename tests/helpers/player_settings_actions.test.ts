import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { getPlayerSettingsMenuItems } from "@/helpers/player_settings_actions";
import {
  PlayerType,
  ProviderFeature,
  ProviderType,
  type Player,
  type PlayerConfig,
  type PlayerOption,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerManifest } from "../fixtures/providerManifest";

const { apiMock, emitEvent, routerPush, setPreference, storeMock, toastMock } =
  vi.hoisted(() => ({
    apiMock: {
      getProvider: vi.fn(),
      getProviderManifest: vi.fn(),
      players: {} as Record<string, unknown>,
      queues: {} as Record<string, unknown>,
      removePlayer: vi.fn(),
      savePlayerConfig: vi.fn(),
    },
    emitEvent: vi.fn(),
    routerPush: vi.fn(),
    setPreference: vi.fn(),
    storeMock: {
      activePlayerId: undefined as string | undefined,
    },
    toastMock: {
      error: vi.fn(),
      success: vi.fn(),
    },
  }));

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

vi.mock("@/plugins/router", () => ({
  default: {
    push: routerPush,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    setPreference,
  }),
}));

// the setup entry is built and covered where the player menus live
vi.mock("@/helpers/player_menu_items", () => ({
  getPlayerSetupMenuItem: () => undefined,
}));

vi.mock("@/helpers/utils", () => ({
  openLinkInNewTab: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

const SECTION_LABELS = [
  "open_player_settings",
  "open_queue_settings",
  "open_dsp_settings",
  "player_options.open",
];

describe("getPlayerSettingsMenuItems sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer();
    apiMock.getProvider.mockReturnValue(providerInstance());
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
  });

  it("leaves the sections out unless they are asked for", () => {
    const labels = visibleLabels(getPlayerSettingsMenuItems(playerConfig()));

    for (const section of SECTION_LABELS) {
      expect(labels).not.toContain(section);
    }
  });

  it("lists every section a player has", () => {
    const labels = visibleLabels(
      getPlayerSettingsMenuItems(playerConfig(), { includeSections: true }),
    );

    expect(labels.slice(0, SECTION_LABELS.length)).toEqual(SECTION_LABELS);
  });

  it.each([
    ["open_queue_settings", "/settings/editplayer/kitchen/queue"],
    ["open_dsp_settings", "/settings/editplayer/kitchen/dsp"],
    ["player_options.open", "/settings/editplayer/kitchen/options"],
    ["open_player_settings", "/settings/editplayer/kitchen"],
  ])("opens %s at its own tab", (label, path) => {
    const menuItems = getPlayerSettingsMenuItems(playerConfig(), {
      includeSections: true,
    });

    menuItems.find((item) => item.label === label)?.action?.();

    expect(routerPush).toHaveBeenCalledWith(path);
  });

  it("leaves out the queue section for a player without a queue", () => {
    apiMock.queues = {};

    expect(sectionLabels()).not.toContain("open_queue_settings");
  });

  it("leaves out the DSP section for a group player", () => {
    registerPlayer({ type: PlayerType.GROUP });

    expect(sectionLabels()).not.toContain("open_dsp_settings");
  });

  it("leaves out the options section for a player exposing none", () => {
    registerPlayer({ options: [] });

    expect(sectionLabels()).not.toContain("player_options.open");
  });
});

describe("getPlayerSettingsMenuItems actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer();
    apiMock.getProvider.mockReturnValue(providerInstance());
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
    apiMock.savePlayerConfig.mockResolvedValue({});
    apiMock.removePlayer.mockResolvedValue(undefined);
    storeMock.activePlayerId = undefined;
  });

  it("opens the rename dialog on the name the player carries", () => {
    const config = playerConfig({
      name: "Kitchen",
      default_name: "Chromecast",
    });

    menuItem(
      getPlayerSettingsMenuItems(config),
      "player_select.rename_player",
    ).action?.();

    expect(emitEvent).toHaveBeenCalledWith("playerRenameDialog", {
      playerId: "kitchen",
      name: "Kitchen",
      defaultName: "Chromecast",
    });
  });

  it("asks before disabling a player", async () => {
    const menuItems = getPlayerSettingsMenuItems(playerConfig());

    menuItem(menuItems, "settings.disable").action?.();

    expect(apiMock.savePlayerConfig).not.toHaveBeenCalled();
    await confirmation().onConfirm();
    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      enabled: false,
    });
  });

  it("enables a player without asking", () => {
    const menuItems = getPlayerSettingsMenuItems(
      playerConfig({ enabled: false }),
    );

    menuItem(menuItems, "settings.enable").action?.();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      enabled: true,
    });
    expect(emitEvent).not.toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.anything(),
    );
  });

  it("asks before deleting a player and reports it gone", async () => {
    const onDeleted = vi.fn();
    const menuItems = getPlayerSettingsMenuItems(playerConfig(), { onDeleted });

    menuItem(menuItems, "settings.delete").action?.();

    expect(apiMock.removePlayer).not.toHaveBeenCalled();
    await confirmation().onConfirm();
    expect(apiMock.removePlayer).toHaveBeenCalledWith("kitchen");
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("keeps the player around when its removal fails", async () => {
    const onDeleted = vi.fn();
    apiMock.removePlayer.mockRejectedValueOnce(new Error("Remove failed"));
    const menuItems = getPlayerSettingsMenuItems(playerConfig(), { onDeleted });

    menuItem(menuItems, "settings.delete").action?.();
    await confirmation().onConfirm();

    expect(onDeleted).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith("Error: Remove failed");
  });

  it("offers no deletion for a provider that cannot remove the player", () => {
    apiMock.getProvider.mockReturnValue(
      providerInstance({ supported_features: [] }),
    );

    expect(
      visibleLabels(getPlayerSettingsMenuItems(playerConfig())),
    ).not.toContain("settings.delete");
  });

  it.each(["settings.disable", "settings.delete"])(
    "hands the player bar to another player after %s",
    async (label) => {
      registerPlayer();
      apiMock.players = {
        ...apiMock.players,
        office: player({ player_id: "office" }),
      };
      storeMock.activePlayerId = "kitchen";

      menuItem(getPlayerSettingsMenuItems(playerConfig()), label).action?.();
      await confirmation().onConfirm();

      expect(storeMock.activePlayerId).toBe("office");
    },
  );

  it("forgets the remembered player when it was the last one", async () => {
    storeMock.activePlayerId = "kitchen";

    menuItem(
      getPlayerSettingsMenuItems(playerConfig()),
      "settings.disable",
    ).action?.();
    await confirmation().onConfirm();

    expect(storeMock.activePlayerId).toBeUndefined();
    expect(setPreference).toHaveBeenCalledWith("activePlayerId", null);
  });

  it("leaves the player bar alone when another player is active", async () => {
    apiMock.players = {
      ...apiMock.players,
      office: player({ player_id: "office" }),
    };
    storeMock.activePlayerId = "office";

    menuItem(
      getPlayerSettingsMenuItems(playerConfig()),
      "settings.delete",
    ).action?.();
    await confirmation().onConfirm();

    expect(storeMock.activePlayerId).toBe("office");
    expect(setPreference).not.toHaveBeenCalled();
  });
});

/**
 * The labels a user actually sees, so an entry the menu hides counts as absent.
 */
function visibleLabels(menuItems: ContextMenuItem[]): string[] {
  return menuItems.filter((item) => !item.hide).map((item) => item.label);
}

function sectionLabels(): string[] {
  return visibleLabels(
    getPlayerSettingsMenuItems(playerConfig(), { includeSections: true }),
  );
}

function menuItem(
  menuItems: ContextMenuItem[],
  label: string,
): ContextMenuItem {
  const menuItem = menuItems.find((item) => item.label === label);
  if (!menuItem) throw new Error(`The menu has no "${label}" entry`);
  return menuItem;
}

/**
 * The confirmation the last action asked for.
 */
function confirmation(): { onConfirm: () => Promise<void> } {
  const event = emitEvent.mock.calls.find(
    ([name]) => name === "deleteConfirmationDialog",
  )?.[1];
  if (!event) throw new Error("No confirmation was asked for");
  return event as { onConfirm: () => Promise<void> };
}

/**
 * Register a player that has every settings section to offer.
 */
function registerPlayer(overrides: Partial<Player> = {}) {
  apiMock.players = { kitchen: player(overrides) };
  apiMock.queues = { kitchen: { queue_id: "kitchen" } };
}

function player(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "kitchen",
    provider: "chromecast--1",
    name: "Kitchen",
    type: PlayerType.PLAYER,
    available: true,
    enabled: true,
    needs_setup: false,
    hide_in_ui: false,
    synced_to: null,
    options: [{ key: "eq", name: "EQ" } as PlayerOption],
    ...overrides,
  } as Player;
}

function playerConfig(overrides: Partial<PlayerConfig> = {}): PlayerConfig {
  return {
    player_id: "kitchen",
    provider: "chromecast--1",
    enabled: true,
    name: null,
    default_name: "Chromecast",
    values: {},
    ...overrides,
  };
}

function providerInstance(
  overrides: Partial<ProviderInstance> = {},
): ProviderInstance {
  return {
    type: ProviderType.PLAYER,
    domain: "chromecast",
    instance_id: "chromecast--1",
    name: "Chromecast",
    available: true,
    is_streaming_provider: null,
    supported_features: [ProviderFeature.REMOVE_PLAYER],
    ...overrides,
  };
}
