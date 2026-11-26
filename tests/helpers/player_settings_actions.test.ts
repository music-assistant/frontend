import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  addSubwoofer,
  createMultiChannelPlayer,
  getOutputMenuItems,
  getPlayerSettingsMenuItems,
  getSetupRequiredPlayerMenuItems,
  isPlayerBeingRemoved,
  mergePlayer,
  removeUnavailablePlayers,
  renamePlayer,
  setPlayerEnabled,
} from "@/helpers/player_settings_actions";
import {
  ChannelLayout,
  ConfigEntryType,
  PlayerType,
  ProtocolRole,
  ProviderFeature,
  ProviderType,
  Scope,
  SpeakerChannel,
  type ConfigEntry,
  type OutputProtocol,
  type Player,
  type PlayerOption,
  type PlayerProtocolInfo,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { outputProtocol } from "../fixtures/outputProtocol";
import { playerConfig } from "../fixtures/playerConfig";
import { providerManifest } from "../fixtures/providerManifest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const {
  apiMock,
  emitEvent,
  hasScope,
  routerPush,
  setPreference,
  storeMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    addMultiChannelSpeaker: vi.fn(),
    createMultiChannelPlayer: vi.fn(),
    getProvider: vi.fn(),
    getPlayerConfig: vi.fn(),
    getProviderManifest: vi.fn(),
    mergePlayers: vi.fn(),
    players: {} as Record<string, unknown>,
    queues: {} as Record<string, unknown>,
    removeMultiChannelSpeaker: vi.fn(),
    removePlayer: vi.fn(),
    removeUnavailablePlayers: vi.fn(),
    savePlayerConfig: vi.fn(),
    unlinkProtocol: vi.fn(),
  },
  emitEvent: vi.fn(),
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  routerPush: vi.fn(),
  setPreference: vi.fn(),
  storeMock: {
    activePlayerId: undefined as string | undefined,
    showFullscreenPlayer: false,
    showPlayersMenu: false,
  },
  toastMock: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
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

// a count, where one is passed, shows in the text so a test can read it back
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, count?: unknown) =>
    typeof count === "number" ? `${key} (${count})` : key,
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
  setUserPreference: setPreference,
}));

// the setup entry is built and covered where the player menus live
vi.mock("@/helpers/player_menu_items", () => ({
  getPlayerSetupMenuItem: (player: Player) =>
    player.needs_setup ? { label: "configure_player" } : undefined,
}));

vi.mock("@/helpers/utils", () => ({
  openLinkInNewTab: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

// the layouts of the Sendspin provider, as the server lists them
const LAYOUTS = {
  [ChannelLayout.STEREO]: [
    SpeakerChannel.FRONT_LEFT,
    SpeakerChannel.FRONT_RIGHT,
  ],
  [ChannelLayout.LAYOUT_2_1]: [
    SpeakerChannel.FRONT_LEFT,
    SpeakerChannel.FRONT_RIGHT,
    SpeakerChannel.LFE,
  ],
  [ChannelLayout.LAYOUT_1_1]: [SpeakerChannel.FRONT_CENTER, SpeakerChannel.LFE],
};

const SECTION_LABELS = [
  "open_player_settings",
  "open_queue_settings",
  "open_dsp_settings",
  "player_options.open",
];

// an admin unless a test says otherwise
beforeEach(() => {
  hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
});

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
    ["open_queue_settings", "/settings/editqueue/kitchen"],
    ["open_dsp_settings", "/settings/editplayer/kitchen/dsp"],
    ["player_options.open", "/settings/editplayer/kitchen/options"],
    ["open_player_settings", "/settings/editplayer/kitchen"],
  ])("opens %s on its own page", (label, path) => {
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

  it("keeps the confirmation open until the player is disabled", async () => {
    let finishSave!: () => void;
    apiMock.savePlayerConfig.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    );
    const menuItems = getPlayerSettingsMenuItems(playerConfig());
    menuItem(menuItems, "settings.disable").action?.();

    let confirmed = false;
    const confirming = Promise.resolve(confirmation().onConfirm()).then(() => {
      confirmed = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(confirmed).toBe(false);

    finishSave();
    await confirming;
    expect(confirmed).toBe(true);
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
    // the api layer reports the failure, so this must not toast a second time
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("offers deletion whatever the provider advertises", () => {
    apiMock.getProvider.mockReturnValue(
      providerInstance({ supported_features: [] }),
    );

    expect(visibleLabels(getPlayerSettingsMenuItems(playerConfig()))).toContain(
      "settings.delete",
    );
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
      // the remembered one is gone for good, and waiting for it to come back
      // would leave the next visit with no player at all
      expect(setPreference).toHaveBeenCalledWith("activePlayerId", null);
    },
  );

  it("forgets the remembered player when it leaves", async () => {
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
    // it was not the player that left, so nothing about the selection changes
    expect(setPreference).not.toHaveBeenCalled();
  });
});

describe("getPlayerSettingsMenuItems from the stored config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
  });

  it("manages a player whose provider is not running", () => {
    registerPlayer({ available: false });
    apiMock.getProvider.mockReturnValue(undefined);

    const menuItems = getPlayerSettingsMenuItems(playerConfig(), {
      includeSections: true,
    });

    expect(menuItem(menuItems, "open_player_settings").disabled).toBeFalsy();
    expect(visibleLabels(menuItems)).toEqual(
      expect.arrayContaining(["settings.disable", "settings.delete"]),
    );
    menuItem(menuItems, "open_player_settings").action?.();
    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
  });

  it("manages a disabled player, which has no live state, without its provider", () => {
    apiMock.players = {};
    apiMock.queues = {};
    apiMock.getProvider.mockReturnValue(undefined);

    const menuItems = getPlayerSettingsMenuItems(
      playerConfig({ enabled: false }),
      { includeSections: true },
    );

    expect(menuItem(menuItems, "open_player_settings").disabled).toBeFalsy();
    expect(visibleLabels(menuItems)).toEqual(
      expect.arrayContaining(["settings.enable", "settings.delete"]),
    );
    // the sections that only live state fills have nothing to show
    for (const section of SECTION_LABELS.slice(1)) {
      expect(visibleLabels(menuItems)).not.toContain(section);
    }
  });
});

describe("removeUnavailablePlayers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer({ available: false });
    apiMock.players = {
      ...apiMock.players,
      office: player({ player_id: "office" }),
    };
    storeMock.activePlayerId = undefined;
  });

  it("asks with the count the server reports before it removes anything", async () => {
    apiMock.removeUnavailablePlayers.mockResolvedValueOnce([
      "kitchen",
      "garage",
      "attic",
    ]);

    await removeUnavailablePlayers([]);

    expect(apiMock.removeUnavailablePlayers).toHaveBeenCalledOnce();
    expect(apiMock.removeUnavailablePlayers).toHaveBeenCalledWith(true);
    expect(emitEvent).toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.objectContaining({
        message: "settings.remove_unavailable_players_confirmation (3)",
      }),
    );
  });

  it("names the players as the settings list does, in its order, and an unlisted one by its id", async () => {
    apiMock.removeUnavailablePlayers.mockResolvedValueOnce([
      "kitchen",
      "lost",
      "attic",
      "garage",
    ]);
    // the settings list, which also holds a player the server keeps
    const listedConfigs = [
      playerConfig({ player_id: "attic", name: "Attic speaker" }),
      playerConfig({ player_id: "garage", default_name: "Garage Cast" }),
      // without a name of its own, the list shows the name the player reports
      playerConfig({ player_id: "kitchen" }),
      playerConfig({ player_id: "office", name: "Office" }),
    ];

    await removeUnavailablePlayers(listedConfigs);

    expect(emitEvent).toHaveBeenCalledWith(
      "deleteConfirmationDialog",
      expect.objectContaining({
        items: ["Attic speaker", "Garage Cast", "Kitchen", "lost"],
      }),
    );
  });

  it("removes the players and reports the ones the server removed", async () => {
    apiMock.removeUnavailablePlayers
      .mockResolvedValueOnce(["kitchen"])
      .mockResolvedValueOnce(["kitchen"]);
    storeMock.activePlayerId = "kitchen";
    const onRemoved = vi.fn();

    await removeUnavailablePlayers([], onRemoved);
    await confirmation().onConfirm();

    expect(apiMock.removeUnavailablePlayers).toHaveBeenLastCalledWith();
    expect(onRemoved).toHaveBeenCalledWith(["kitchen"]);
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.unavailable_players_removed (1)",
    );
    expect(storeMock.activePlayerId).toBe("office");
  });

  it("removes nothing when the user does not confirm", async () => {
    apiMock.removeUnavailablePlayers.mockResolvedValueOnce(["kitchen"]);
    const onRemoved = vi.fn();

    await removeUnavailablePlayers([], onRemoved);

    expect(apiMock.removeUnavailablePlayers).toHaveBeenCalledOnce();
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("says so when there is nothing to remove, without asking", async () => {
    apiMock.removeUnavailablePlayers.mockResolvedValueOnce([]);

    await removeUnavailablePlayers([]);

    expect(toastMock.info).toHaveBeenCalledWith(
      "settings.no_unavailable_players",
    );
    expect(emitEvent).not.toHaveBeenCalled();
    expect(apiMock.removeUnavailablePlayers).toHaveBeenCalledOnce();
  });

  it("asks nothing when the server refuses, and leaves its reason to the api", async () => {
    apiMock.removeUnavailablePlayers.mockRejectedValueOnce(
      new Error("Players are still being found, try again in 42 seconds"),
    );

    await removeUnavailablePlayers([]);

    expect(emitEvent).not.toHaveBeenCalled();
    expect(apiMock.removeUnavailablePlayers).toHaveBeenCalledOnce();
    // the api layer toasts the server's reason, so this must not toast a second time
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.info).not.toHaveBeenCalled();
  });
});

describe("getPlayerSettingsMenuItems provider settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer();
    apiMock.getProvider.mockReturnValue(providerInstance());
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
  });

  const offersProviderSettings = () =>
    visibleLabels(getPlayerSettingsMenuItems(playerConfig())).includes(
      "settings.provider_settings",
    );

  it("links an admin to the settings of the player provider", () => {
    expect(offersProviderSettings()).toBe(true);
  });

  it.each([
    { role: "a member", scopes: BUILTIN_ROLE_SCOPES.user },
    { role: "a guest", scopes: BUILTIN_ROLE_SCOPES.guest },
    {
      role: "a role that only changes player settings",
      scopes: [...BUILTIN_ROLE_SCOPES.guest, Scope.CONFIG_PLAYERS_WRITE],
    },
  ])(
    "keeps $role away from the settings of the player provider",
    ({ scopes }) => {
      hasScope.mockImplementation(scopeChecker(scopes));

      expect(offersProviderSettings()).toBe(false);
    },
  );
});

describe("getSetupRequiredPlayerMenuItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.savePlayerConfig.mockResolvedValue({});
  });

  const setupRequiredPlayer = () =>
    player({ name: "Living Room (2)", available: false, needs_setup: true });

  it("offers to set the player up, rename it, open its settings and disable it", () => {
    expect(
      visibleLabels(getSetupRequiredPlayerMenuItems(setupRequiredPlayer())),
    ).toEqual([
      "configure_player",
      "player_select.rename_player",
      "open_settings",
      "settings.disable",
    ]);
  });

  it("offers nothing to a role that may not change player settings", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    expect(getSetupRequiredPlayerMenuItems(setupRequiredPlayer())).toEqual([]);
  });

  it("opens the rename dialog on the names the player config carries", async () => {
    apiMock.getPlayerConfig.mockResolvedValue(
      playerConfig({ name: null, default_name: "Living Room (2)" }),
    );

    menuItem(
      getSetupRequiredPlayerMenuItems(setupRequiredPlayer()),
      "player_select.rename_player",
    ).action?.();
    await flushPromises();

    expect(apiMock.getPlayerConfig).toHaveBeenCalledWith("kitchen");
    expect(emitEvent).toHaveBeenCalledWith("playerRenameDialog", {
      playerId: "kitchen",
      name: null,
      defaultName: "Living Room (2)",
    });
  });

  it("opens no rename dialog when the config does not load, and leaves the message to the api", async () => {
    apiMock.getPlayerConfig.mockRejectedValue(new Error("Lookup failed"));

    menuItem(
      getSetupRequiredPlayerMenuItems(setupRequiredPlayer()),
      "player_select.rename_player",
    ).action?.();
    await flushPromises();

    expect(emitEvent).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("closes the player surfaces on the way to the player settings", () => {
    storeMock.showFullscreenPlayer = true;
    storeMock.showPlayersMenu = true;

    menuItem(
      getSetupRequiredPlayerMenuItems(setupRequiredPlayer()),
      "open_settings",
    ).action?.();

    expect(storeMock.showFullscreenPlayer).toBe(false);
    expect(storeMock.showPlayersMenu).toBe(false);
    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
  });

  it("asks before disabling the player", async () => {
    menuItem(
      getSetupRequiredPlayerMenuItems(setupRequiredPlayer()),
      "settings.disable",
    ).action?.();

    expect(apiMock.savePlayerConfig).not.toHaveBeenCalled();
    await confirmation().onConfirm();
    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      enabled: false,
    });
  });
});

describe("setPlayerEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer();
    apiMock.savePlayerConfig.mockResolvedValue({});
    storeMock.activePlayerId = undefined;
  });

  it("saves the state and says the change landed", async () => {
    await expect(setPlayerEnabled("kitchen", false)).resolves.toBe(true);

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      enabled: false,
    });
    expect(toastMock.success).toHaveBeenCalledWith("settings.player_saved");
  });

  it("hands the player bar on when the player it points at is switched off", async () => {
    apiMock.players = {
      ...apiMock.players,
      office: player({ player_id: "office" }),
    };
    storeMock.activePlayerId = "kitchen";

    await setPlayerEnabled("kitchen", false);

    expect(storeMock.activePlayerId).toBe("office");
    expect(setPreference).toHaveBeenCalledWith("activePlayerId", null);
  });

  it("leaves the player bar where it is when a player is switched on", async () => {
    storeMock.activePlayerId = "kitchen";

    await setPlayerEnabled("kitchen", true);

    // the player is coming back, not leaving: nothing about the selection changes
    expect(storeMock.activePlayerId).toBe("kitchen");
    expect(setPreference).not.toHaveBeenCalled();
  });

  it("says a save that did not land, and leaves the message to the api", async () => {
    apiMock.savePlayerConfig.mockRejectedValueOnce(new Error("Save failed"));

    await expect(setPlayerEnabled("kitchen", false)).resolves.toBe(false);

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

describe("renamePlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.savePlayerConfig.mockResolvedValue({});
  });

  it("saves the name and says the change landed", async () => {
    await expect(renamePlayer("kitchen", "Attic")).resolves.toBe(true);

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      name: "Attic",
    });
    expect(toastMock.success).toHaveBeenCalledWith("settings.player_saved");
  });

  it("hands the player back to the name its provider reports", async () => {
    await renamePlayer("kitchen", null);

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      name: null,
    });
  });

  it("says a save that did not land, and leaves the message to the api", async () => {
    apiMock.savePlayerConfig.mockRejectedValueOnce(new Error("Save failed"));

    await expect(renamePlayer("kitchen", "Attic")).resolves.toBe(false);

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

describe("getPlayerSettingsMenuItems merging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer();
    apiMock.getProvider.mockReturnValue(providerInstance());
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
  });

  it("opens the merge dialog for the player", () => {
    const onMerged = vi.fn();
    const menuItems = getPlayerSettingsMenuItems(
      playerConfig({ name: "Kitchen" }),
      { onMerged },
    );

    menuItem(menuItems, "settings.merge_player").action?.();

    expect(emitEvent).toHaveBeenCalledWith("playerMergeDialog", {
      playerId: "kitchen",
      playerName: "Kitchen",
      onMerged,
    });
  });

  it("does not offer to merge a group", () => {
    expect(
      visibleLabels(
        getPlayerSettingsMenuItems(
          playerConfig({ player_type: PlayerType.GROUP }),
        ),
      ),
    ).not.toContain("settings.merge_player");
  });

  it("leaves splitting an output off to the menu of that output", () => {
    registerPlayer({
      protocols: [protocol("chromecast"), protocol("airplay")],
    });

    expect(
      visibleLabels(getPlayerSettingsMenuItems(playerConfig())),
    ).not.toContain("settings.split_off_output");
  });
});

describe("getOutputMenuItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer({
      protocols: [protocol("chromecast"), protocol("airplay")],
    });
    apiMock.getProviderManifest.mockImplementation((domain: string) =>
      providerManifest({ domain, name: domain.toUpperCase() }),
    );
  });

  it("offers to split off an output of a player with more than one", () => {
    expect(
      visibleLabels(getOutputMenuItems(playerConfig(), output("airplay"))),
    ).toEqual(["settings.split_off_output"]);
  });

  it("offers nothing for the only output of a player", () => {
    registerPlayer({ protocols: [protocol("chromecast")] });

    expect(getOutputMenuItems(playerConfig(), output("chromecast"))).toEqual(
      [],
    );
  });

  it("offers nothing for an output that rides on another one", () => {
    const sendspin = output("sendspin", { derived_from: "airplay" });
    registerPlayer({
      protocols: [
        protocol("chromecast"),
        protocol("airplay"),
        protocol("sendspin"),
      ],
      output_protocols: [output("chromecast"), output("airplay"), sendspin],
    });

    expect(getOutputMenuItems(playerConfig(), sendspin)).toEqual([]);
    expect(
      visibleLabels(getOutputMenuItems(playerConfig(), output("airplay"))),
    ).toEqual(["settings.split_off_output"]);
  });

  it("offers nothing for a player that has no live state", () => {
    apiMock.players = {};

    expect(getOutputMenuItems(playerConfig(), output("airplay"))).toEqual([]);
  });

  it("splits the output off after asking and reports the new player", async () => {
    const onSplitOff = vi.fn();
    apiMock.unlinkProtocol.mockResolvedValue("new-player");

    menuItem(
      getOutputMenuItems(playerConfig(), output("airplay"), { onSplitOff }),
      "settings.split_off_output",
    ).action?.();

    expect(apiMock.unlinkProtocol).not.toHaveBeenCalled();
    await confirmation().onConfirm();
    expect(apiMock.unlinkProtocol).toHaveBeenCalledWith("airplay");
    expect(onSplitOff).toHaveBeenCalledOnce();
    expect(toastMock.success).toHaveBeenCalledOnce();
  });

  it("splits off the protocol behind the native output", async () => {
    apiMock.unlinkProtocol.mockResolvedValue("new-player");
    registerPlayer({
      protocols: [
        {
          ...protocol("sonos"),
          protocol_id: "RINCON_1",
          role: ProtocolRole.NATIVE,
        },
        protocol("airplay"),
      ],
    });

    menuItem(
      getOutputMenuItems(
        playerConfig(),
        output("sonos", { output_protocol_id: "native", is_native: true }),
      ),
      "settings.split_off_output",
    ).action?.();
    await confirmation().onConfirm();

    expect(apiMock.unlinkProtocol).toHaveBeenCalledWith("RINCON_1");
  });

  it("leaves the player as it is when the server refuses the split", async () => {
    const onSplitOff = vi.fn();
    apiMock.unlinkProtocol.mockRejectedValueOnce(new Error("Refused"));

    menuItem(
      getOutputMenuItems(playerConfig(), output("chromecast"), { onSplitOff }),
      "settings.split_off_output",
    ).action?.();
    await confirmation().onConfirm();

    expect(onSplitOff).not.toHaveBeenCalled();
    // the api layer reports the server's reason, so this must not toast a second time
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

describe("getOutputMenuItems multi-channel player", () => {
  const sendspin = (): PlayerProtocolInfo => ({
    ...protocol("sendspin"),
    protocol_id: "studio-left-client",
    role: ProtocolRole.NATIVE,
  });
  const native = () =>
    output("sendspin", { output_protocol_id: "native", is_native: true });
  // the server lists this player as a candidate speaker on Sendspin
  const multiChannelCandidates = { sendspin: ["studio-right", "kitchen"] };
  const multiChannelLayouts = { sendspin: LAYOUTS };

  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer({ protocols: [sendspin()], output_protocols: [native()] });
    apiMock.getProvider.mockImplementation((instanceId: string) =>
      providerInstance({
        domain: instanceId,
        instance_id: instanceId,
        supported_features:
          instanceId === "sendspin"
            ? [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER]
            : [],
      }),
    );
    apiMock.getProviderManifest.mockImplementation((domain: string) =>
      providerManifest({ domain, name: domain }),
    );
  });

  it("offers it on an output of a provider that combines speakers", () => {
    const onMultiChannelCreated = vi.fn();

    menuItem(
      getOutputMenuItems(playerConfig(), native(), {
        multiChannelCandidates,
        multiChannelLayouts,
        onMultiChannelCreated,
      }),
      "settings.multi_channel.make",
    ).action?.();

    expect(emitEvent).toHaveBeenCalledWith("multiChannelPlayerDialog", {
      playerId: "kitchen",
      playerName: "Kitchen",
      protocol: sendspin(),
      layouts: LAYOUTS,
      onCreated: onMultiChannelCreated,
    });
  });

  it("offers it after splitting off, on a player with more than one output", () => {
    registerPlayer({
      protocols: [sendspin(), protocol("airplay")],
      output_protocols: [native(), output("airplay")],
    });

    expect(
      visibleLabels(
        getOutputMenuItems(playerConfig(), native(), {
          multiChannelCandidates,
          multiChannelLayouts,
        }),
      ),
    ).toEqual(["settings.split_off_output", "settings.multi_channel.make"]);
    // AirPlay can not combine speakers
    expect(
      visibleLabels(
        getOutputMenuItems(playerConfig(), output("airplay"), {
          multiChannelCandidates: { airplay: ["kitchen"] },
          multiChannelLayouts: { airplay: LAYOUTS },
        }),
      ),
    ).toEqual(["settings.split_off_output"]);
  });

  it("offers nothing for a player the server does not list", () => {
    expect(
      getOutputMenuItems(playerConfig(), native(), {
        multiChannelCandidates: { sendspin: ["studio-right"] },
        multiChannelLayouts,
      }),
    ).toEqual([]);
    // before the list is there
    expect(getOutputMenuItems(playerConfig(), native())).toEqual([]);
  });

  it("offers nothing while the server lists no layouts for the provider", () => {
    expect(
      getOutputMenuItems(playerConfig(), native(), { multiChannelCandidates }),
    ).toEqual([]);
    expect(
      getOutputMenuItems(playerConfig(), native(), {
        multiChannelCandidates,
        multiChannelLayouts: { sendspin: {} },
      }),
    ).toEqual([]);
  });
});

describe("getPlayerSettingsMenuItems taking a multi-channel player apart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.activePlayerId = undefined;
    registerPlayer({ type: PlayerType.MULTI_CHANNEL });
    apiMock.getProvider.mockReturnValue(
      providerInstance({
        supported_features: [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER],
      }),
    );
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
  });

  it("takes apart a player its provider combined, rather than deleting or merging it", () => {
    const labels = visibleLabels(getPlayerSettingsMenuItems(playerConfig()));

    expect(labels).toContain("settings.multi_channel.take_apart");
    expect(labels).not.toContain("settings.delete");
    expect(labels).not.toContain("settings.merge_player");
  });

  it("deletes and merges a player that is no multi-channel player, or that came that way", () => {
    expect(visibleLabels(getPlayerSettingsMenuItems(playerConfig()))).toContain(
      "settings.multi_channel.take_apart",
    );

    registerPlayer({ type: PlayerType.PLAYER });
    let labels = visibleLabels(getPlayerSettingsMenuItems(playerConfig()));
    expect(labels).toEqual(
      expect.arrayContaining(["settings.delete", "settings.merge_player"]),
    );
    expect(labels).not.toContain("settings.multi_channel.take_apart");

    // a set the device delivers (a Sonos pair) is not one the provider can combine
    registerPlayer({ type: PlayerType.MULTI_CHANNEL });
    apiMock.getProvider.mockReturnValue(providerInstance());
    labels = visibleLabels(getPlayerSettingsMenuItems(playerConfig()));
    expect(labels).toEqual(
      expect.arrayContaining(["settings.delete", "settings.merge_player"]),
    );
    expect(labels).not.toContain("settings.multi_channel.take_apart");
  });

  it("takes apart a disabled set as well, which has no live state", () => {
    apiMock.players = {};
    const disabledSet = playerConfig({
      enabled: false,
      player_type: PlayerType.MULTI_CHANNEL,
    });

    let labels = visibleLabels(getPlayerSettingsMenuItems(disabledSet));
    expect(labels).toContain("settings.multi_channel.take_apart");
    expect(labels).not.toContain("settings.delete");
    expect(labels).not.toContain("settings.merge_player");

    // a disabled set the device delivers keeps what it has
    apiMock.getProvider.mockReturnValue(providerInstance());
    labels = visibleLabels(getPlayerSettingsMenuItems(disabledSet));
    expect(labels).toEqual(
      expect.arrayContaining(["settings.delete", "settings.merge_player"]),
    );
    expect(labels).not.toContain("settings.multi_channel.take_apart");
  });

  it("removes the player after asking and reports it taken apart", async () => {
    const onDeleted = vi.fn();
    apiMock.removePlayer.mockResolvedValue(undefined);
    storeMock.activePlayerId = "kitchen";

    menuItem(
      getPlayerSettingsMenuItems(playerConfig(), { onDeleted }),
      "settings.multi_channel.take_apart",
    ).action?.();

    expect(apiMock.removePlayer).not.toHaveBeenCalled();
    await confirmation().onConfirm();
    expect(apiMock.removePlayer).toHaveBeenCalledWith("kitchen");
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(toastMock.success).toHaveBeenCalledOnce();
    expect(setPreference).toHaveBeenCalledWith("activePlayerId", null);
  });

  it("keeps the player when the server refuses to take it apart", async () => {
    const onDeleted = vi.fn();
    apiMock.removePlayer.mockRejectedValueOnce(new Error("Refused"));

    menuItem(
      getPlayerSettingsMenuItems(playerConfig(), { onDeleted }),
      "settings.multi_channel.take_apart",
    ).action?.();
    await confirmation().onConfirm();

    expect(onDeleted).not.toHaveBeenCalled();
    // the api layer reports the server's reason, so this must not toast a second time
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

describe("getPlayerSettingsMenuItems subwoofer of a multi-channel player", () => {
  const ADD = "settings.multi_channel.add_subwoofer";
  const REMOVE = "settings.multi_channel.remove_subwoofer";
  // the layouts of the provider of the set, as the server lists them
  const multiChannelLayouts = { "chromecast--1": LAYOUTS };

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getProvider.mockReturnValue(
      providerInstance({
        supported_features: [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER],
      }),
    );
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
  });

  it.each([
    [ChannelLayout.STEREO, [ADD]],
    [ChannelLayout.LAYOUT_2_1, [REMOVE]],
    // without its subwoofer a speaker is no set: taking it apart is the way
    [ChannelLayout.LAYOUT_1_1, []],
    [ChannelLayout.UNKNOWN, []],
  ])("offers for a %s set: %j", (layout, offered) => {
    registerPlayer({ type: PlayerType.MULTI_CHANNEL, channel_layout: layout });

    const labels = visibleLabels(
      getPlayerSettingsMenuItems(playerConfig(), { multiChannelLayouts }),
    );

    expect(labels.filter((label) => label === ADD || label === REMOVE)).toEqual(
      offered,
    );
  });

  it("offers neither without the layouts of the provider", () => {
    registerPlayer({
      type: PlayerType.MULTI_CHANNEL,
      channel_layout: ChannelLayout.STEREO,
    });

    expect(
      visibleLabels(getPlayerSettingsMenuItems(playerConfig())),
    ).not.toContain(ADD);
    // a provider that offers no layout with a subwoofer
    expect(
      visibleLabels(
        getPlayerSettingsMenuItems(playerConfig(), {
          multiChannelLayouts: {
            "chromecast--1": { stereo: LAYOUTS.stereo },
          },
        }),
      ),
    ).not.toContain(ADD);
  });

  it("offers neither for a set the device delivers, or one without live state", () => {
    registerPlayer({
      type: PlayerType.MULTI_CHANNEL,
      channel_layout: ChannelLayout.STEREO,
    });
    apiMock.getProvider.mockReturnValue(providerInstance());
    let labels = visibleLabels(
      getPlayerSettingsMenuItems(playerConfig(), { multiChannelLayouts }),
    );
    expect(labels).not.toContain(ADD);

    apiMock.getProvider.mockReturnValue(
      providerInstance({
        supported_features: [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER],
      }),
    );
    apiMock.players = {};
    labels = visibleLabels(
      getPlayerSettingsMenuItems(
        playerConfig({
          enabled: false,
          player_type: PlayerType.MULTI_CHANNEL,
        }),
        { multiChannelLayouts },
      ),
    );
    expect(labels).not.toContain(ADD);
    expect(labels).not.toContain(REMOVE);
  });

  it("opens the dialog to pick a subwoofer for the set", () => {
    registerPlayer({
      type: PlayerType.MULTI_CHANNEL,
      channel_layout: ChannelLayout.STEREO,
    });
    const onSpeakersChanged = vi.fn();

    menuItem(
      getPlayerSettingsMenuItems(
        playerConfig({ provider: "sendspin--1", name: "Studio" }),
        { multiChannelLayouts: { "sendspin--1": LAYOUTS }, onSpeakersChanged },
      ),
      ADD,
    ).action?.();

    expect(emitEvent).toHaveBeenCalledWith("multiChannelSubwooferDialog", {
      playerId: "kitchen",
      playerName: "Studio",
      provider: "sendspin--1",
      onAdded: onSpeakersChanged,
    });
  });

  it("removes the subwoofer by its number after asking, and reports it", async () => {
    registerPlayer({
      type: PlayerType.MULTI_CHANNEL,
      channel_layout: ChannelLayout.LAYOUT_2_1,
    });
    apiMock.getPlayerConfig.mockResolvedValue(
      playerConfig({
        values: Object.fromEntries(
          [
            ...speakerEntries(1, "Studio left", "front_left"),
            ...speakerEntries(2, "Studio sub", "lfe"),
            ...speakerEntries(3, "Studio right", "front_right"),
          ].map((entry) => [entry.key, entry]),
        ),
      }),
    );
    apiMock.removeMultiChannelSpeaker.mockResolvedValue(undefined);
    const onSpeakersChanged = vi.fn();

    menuItem(
      getPlayerSettingsMenuItems(playerConfig(), {
        multiChannelLayouts,
        onSpeakersChanged,
      }),
      REMOVE,
    ).action?.();
    await flushPromises();

    // the stored config, not the form, says which speaker is the subwoofer
    expect(apiMock.getPlayerConfig).toHaveBeenCalledWith("kitchen");
    expect(apiMock.removeMultiChannelSpeaker).not.toHaveBeenCalled();
    await confirmation().onConfirm();

    expect(apiMock.removeMultiChannelSpeaker).toHaveBeenCalledWith(
      "kitchen",
      2,
    );
    expect(onSpeakersChanged).toHaveBeenCalledOnce();
    expect(toastMock.success).toHaveBeenCalledOnce();
  });

  it("keeps the subwoofer when the server refuses to remove it", async () => {
    registerPlayer({
      type: PlayerType.MULTI_CHANNEL,
      channel_layout: ChannelLayout.LAYOUT_2_1,
    });
    apiMock.getPlayerConfig.mockResolvedValue(
      playerConfig({
        values: Object.fromEntries(
          speakerEntries(1, "Studio sub", "lfe").map((entry) => [
            entry.key,
            entry,
          ]),
        ),
      }),
    );
    apiMock.removeMultiChannelSpeaker.mockRejectedValueOnce(
      new Error("Take the player apart instead."),
    );
    const onSpeakersChanged = vi.fn();

    menuItem(
      getPlayerSettingsMenuItems(playerConfig(), {
        multiChannelLayouts,
        onSpeakersChanged,
      }),
      REMOVE,
    ).action?.();
    await flushPromises();
    await confirmation().onConfirm();

    expect(onSpeakersChanged).not.toHaveBeenCalled();
    // the api layer reports the server's reason, so this must not toast a second time
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  function speakerEntries(
    number: number,
    name: string,
    channel: string,
  ): ConfigEntry[] {
    const entry = (key: string, overrides: Partial<ConfigEntry>) =>
      ({
        key,
        type: ConfigEntryType.STRING,
        label: key,
        default_value: null,
        required: false,
        options: [],
        ...overrides,
      }) as ConfigEntry;
    return [
      entry(`speaker_${number}_state`, {
        type: ConfigEntryType.LABEL,
        default_value: "online",
      }),
      entry(`speaker_${number}_display_name`, {
        type: ConfigEntryType.LABEL,
        value: name,
      }),
      entry(`speaker_${number}_channel_setting`, { value: channel }),
    ];
  }
});

describe("addSubwoofer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.activePlayerId = undefined;
  });

  it("adds the speaker on the subwoofer channel and hands the set its player bar", async () => {
    apiMock.addMultiChannelSpeaker.mockResolvedValue(undefined);
    storeMock.activePlayerId = "studio-sub";

    expect(await addSubwoofer("studio", "Studio", "studio-sub")).toBe(true);

    expect(apiMock.addMultiChannelSpeaker).toHaveBeenCalledWith(
      "studio",
      "studio-sub",
      SpeakerChannel.LFE,
    );
    expect(storeMock.activePlayerId).toBe("studio");
    expect(setPreference).toHaveBeenCalledWith("activePlayerId", "studio");
    expect(toastMock.success).toHaveBeenCalledOnce();
  });

  it("says the speaker did not join when the server refuses, and leaves its reason to the api", async () => {
    apiMock.addMultiChannelSpeaker.mockRejectedValueOnce(
      new Error("Studio sub is not available"),
    );
    storeMock.activePlayerId = "studio-sub";

    expect(await addSubwoofer("studio", "Studio", "studio-sub")).toBe(false);

    expect(storeMock.activePlayerId).toBe("studio-sub");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

describe("createMultiChannelPlayer", () => {
  const members = {
    "studio-left": SpeakerChannel.FRONT_LEFT,
    "studio-right": SpeakerChannel.FRONT_RIGHT,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.activePlayerId = undefined;
  });

  it("returns the new player and hands it the player bar of a speaker", async () => {
    const studio = player({
      player_id: "studio",
      type: PlayerType.MULTI_CHANNEL,
    });
    apiMock.createMultiChannelPlayer.mockResolvedValue(studio);
    storeMock.activePlayerId = "studio-right";

    expect(await createMultiChannelPlayer("sendspin", "Studio", members)).toBe(
      studio,
    );

    expect(apiMock.createMultiChannelPlayer).toHaveBeenCalledWith(
      "sendspin",
      "Studio",
      members,
    );
    expect(storeMock.activePlayerId).toBe("studio");
    expect(setPreference).toHaveBeenCalledWith("activePlayerId", "studio");
    expect(toastMock.success).toHaveBeenCalledOnce();
  });

  it("leaves the player bar on a player that is no speaker of it", async () => {
    apiMock.createMultiChannelPlayer.mockResolvedValue(
      player({ player_id: "studio" }),
    );
    storeMock.activePlayerId = "office";

    await createMultiChannelPlayer("sendspin", "Studio", members);

    expect(storeMock.activePlayerId).toBe("office");
    expect(setPreference).not.toHaveBeenCalled();
  });

  it("returns nothing when the server refuses, and leaves its reason to the api", async () => {
    apiMock.createMultiChannelPlayer.mockRejectedValueOnce(
      new Error("Studio right is not available"),
    );
    storeMock.activePlayerId = "studio-right";

    expect(
      await createMultiChannelPlayer("sendspin", "Studio", members),
    ).toBeUndefined();

    expect(storeMock.activePlayerId).toBe("studio-right");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });
});

describe("isPlayerBeingRemoved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPlayer({ type: PlayerType.MULTI_CHANNEL });
    apiMock.getProvider.mockReturnValue(
      providerInstance({
        supported_features: [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER],
      }),
    );
    apiMock.getProviderManifest.mockReturnValue(providerManifest());
  });

  it.each([
    [
      "combining speakers",
      ["studio-left", "studio-right"],
      () => apiMock.createMultiChannelPlayer,
      () =>
        createMultiChannelPlayer("sendspin", "Studio", {
          "studio-left": SpeakerChannel.FRONT_LEFT,
          "studio-right": SpeakerChannel.FRONT_RIGHT,
        }),
    ],
    [
      "merging a player",
      ["kitchen"],
      () => apiMock.mergePlayers,
      () => mergePlayer("kitchen", "office"),
    ],
    [
      "taking a set apart",
      ["kitchen"],
      () => apiMock.removePlayer,
      async () => {
        menuItem(
          getPlayerSettingsMenuItems(playerConfig()),
          "settings.multi_channel.take_apart",
        ).action?.();
        await confirmation().onConfirm();
      },
    ],
    [
      "deleting a player",
      ["kitchen"],
      () => apiMock.removePlayer,
      async () => {
        registerPlayer();
        menuItem(
          getPlayerSettingsMenuItems(playerConfig()),
          "settings.delete",
        ).action?.();
        await confirmation().onConfirm();
      },
    ],
  ])(
    "holds the players while %s is on its way, done or not",
    async (_, playerIds, command, run) => {
      for (const outcome of ["done", "refused"]) {
        let finish: () => void = () => undefined;
        command().mockReturnValueOnce(
          new Promise((resolve, reject) => {
            finish = () =>
              outcome === "done"
                ? resolve({ player_id: "studio" })
                : reject(new Error("Refused"));
          }),
        );
        emitEvent.mockClear();

        const running = run();
        await Promise.resolve();
        expect(playerIds.map(isPlayerBeingRemoved)).toEqual(
          playerIds.map(() => true),
        );
        expect(isPlayerBeingRemoved("office")).toBe(false);

        finish();
        await running;
        expect(playerIds.map(isPlayerBeingRemoved)).toEqual(
          playerIds.map(() => false),
        );
      }
    },
  );
});

describe("mergePlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.activePlayerId = undefined;
  });

  it("hands the player bar to the player that stays", async () => {
    apiMock.mergePlayers.mockResolvedValue(undefined);
    storeMock.activePlayerId = "kitchen-airplay";

    expect(await mergePlayer("kitchen-airplay", "kitchen")).toBe(true);

    expect(apiMock.mergePlayers).toHaveBeenCalledWith(
      "kitchen-airplay",
      "kitchen",
    );
    expect(storeMock.activePlayerId).toBe("kitchen");
    expect(setPreference).toHaveBeenCalledWith("activePlayerId", "kitchen");
    expect(toastMock.success).toHaveBeenCalledOnce();
  });

  it("keeps everything as it is when the server refuses the merge", async () => {
    apiMock.mergePlayers.mockRejectedValueOnce(new Error("Refused"));
    storeMock.activePlayerId = "kitchen-airplay";

    expect(await mergePlayer("kitchen-airplay", "kitchen")).toBe(false);

    expect(storeMock.activePlayerId).toBe("kitchen-airplay");
    expect(setPreference).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
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
    protocols: [],
    output_protocols: [],
    ...overrides,
  } as Player;
}

function protocol(domain: string): PlayerProtocolInfo {
  return {
    protocol_id: domain,
    domain,
    provider: domain,
    role: ProtocolRole.AUDIO,
    available: true,
    active: false,
  };
}

/**
 * The output a protocol of the given domain gives a player.
 */
function output(
  domain: string,
  overrides: Partial<OutputProtocol> = {},
): OutputProtocol {
  return outputProtocol({
    output_protocol_id: domain,
    name: domain,
    protocol_domain: domain,
    ...overrides,
  });
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
    supported_artist_types: [],
    ...overrides,
  };
}
