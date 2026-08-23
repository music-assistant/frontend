import type { ContextMenuItem } from "@/helpers/context_menu_item";
import api from "@/plugins/api";
import {
  getPlayerMenuItems,
  getPlayerSetupMenuItem,
} from "@/helpers/player_menu_items";
import {
  PLAYER_CONTROL_NONE,
  PlayerFeature,
  PlayerType,
  type AIRadioHost,
  type AIRadioSession,
  type AIRadioStation,
  type Player,
  type PlayerOption,
  type PlayerQueue,
  type PlayerSource,
  RepeatMode,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";
import { playerSource } from "../fixtures/playerSource";

const {
  aiRadioAvailableRef,
  announcementAvailableRef,
  emitEvent,
  hostsRef,
  isAdmin,
  loadHosts,
  loadQueueDjStatus,
  loadStatus,
  openAnnouncementDialog,
  queueDjStatusRef,
  togglePlayerPower,
  routerPush,
  sessionsRef,
  setQueueDj,
  showsRef,
  storeMock,
} = vi.hoisted(() => ({
  aiRadioAvailableRef: { value: false },
  announcementAvailableRef: { value: false },
  emitEvent: vi.fn(),
  hostsRef: { value: [] as AIRadioHost[] },
  isAdmin: vi.fn(),
  loadHosts: vi.fn().mockResolvedValue(undefined),
  loadQueueDjStatus: vi.fn().mockResolvedValue(undefined),
  loadStatus: vi.fn().mockResolvedValue(undefined),
  openAnnouncementDialog: vi.fn(),
  queueDjStatusRef: { value: {} as Record<string, string> },
  togglePlayerPower: vi.fn(),
  routerPush: vi.fn(),
  sessionsRef: { value: [] as AIRadioSession[] },
  setQueueDj: vi.fn(),
  showsRef: { value: [] as AIRadioStation[] },
  storeMock: {
    showFullscreenPlayer: true,
    showPlayersMenu: true,
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    players: {},
    providers: {
      milkdrop_visualizer: { domain: "milkdrop_visualizer", available: true },
    },
    queueCommandShuffle: vi.fn(),
    queueCommandRepeat: vi.fn(),
    playerCommandShuffle: vi.fn(),
    playerCommandRepeat: vi.fn(),
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isAdmin,
  },
}));

vi.mock("@/plugins/router", () => ({
  default: {
    push: routerPush,
  },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    emit: emitEvent,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/helpers/player_group_playback", () => ({
  togglePlayerPower,
}));

vi.mock("@/helpers/sleep_timer", () => ({
  getSleepTimerMenuItem: vi.fn(),
  sleepTimerActive: () => false,
}));

vi.mock("@/composables/useAnnouncement", () => ({
  useAnnouncement: () => ({
    announcementAvailable: announcementAvailableRef,
    openAnnouncementDialog,
  }),
}));

vi.mock("@/composables/useAudioOverlay", () => ({
  useAudioOverlay: () => ({
    openOverlayDialog: vi.fn(),
    overlayAvailable: { value: false },
  }),
}));

vi.mock("@/composables/ai-radio/useHosts", () => ({
  useHosts: () => ({
    hosts: hostsRef,
    queueDjStatus: queueDjStatusRef,
    aiRadioAvailable: aiRadioAvailableRef,
    loadHosts,
    loadQueueDjStatus,
    setQueueDj,
  }),
}));

vi.mock("@/composables/ai-radio/useShows", () => ({
  useShows: () => ({
    sessions: sessionsRef,
    shows: showsRef,
    loadStatus,
  }),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "kitchen",
    type: PlayerType.PLAYER,
    power_control: PLAYER_CONTROL_NONE,
    supported_features: [],
    source_list: [],
    sound_mode_list: [],
    options: [],
    needs_setup: false,
    ...overrides,
  } as Player;
}

function makeQueue(overrides: Partial<PlayerQueue> = {}): PlayerQueue {
  return playerQueue({ queue_id: "kitchen", ...overrides });
}

function openSettingsItem(
  menuItems: ContextMenuItem[],
): ContextMenuItem | undefined {
  return menuItems.find((item) => item.label === "open_settings");
}

function makeHost(overrides: Partial<AIRadioHost> = {}): AIRadioHost {
  return {
    id: "host-1",
    name: "Robo DJ",
    instructions: "",
    tts_engine: "",
    language: "",
    options: {},
    section_ids: [],
    section_order: [],
    merge_section_id: "",
    ...overrides,
  };
}

function makeShow(overrides: Partial<AIRadioStation> = {}): AIRadioStation {
  return {
    id: "show-1",
    name: "Morning Mix",
    source_playlist_id: "42",
    source_playlist_provider: "library",
    host_id: "host-1",
    ...overrides,
  };
}

function makeSession(overrides: Partial<AIRadioSession> = {}): AIRadioSession {
  return {
    session_id: "session-1",
    station_id: "show-1",
    queue_id: "kitchen",
    status: "running",
    created_at: "2026-08-01T00:00:00Z",
    started_at: "2026-08-01T00:00:00Z",
    ended_at: null,
    error: null,
    last_render_error: null,
    ...overrides,
  };
}

describe("getPlayerSetupMenuItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.showFullscreenPlayer = true;
    storeMock.showPlayersMenu = true;
  });

  it("omits players without a setup flow", () => {
    expect(
      getPlayerSetupMenuItem({
        player_id: "kitchen",
        needs_setup: false,
        has_setup_flow: false,
      }),
    ).toBeUndefined();
  });

  it("offers to reconfigure a configured player", () => {
    const item = getPlayerSetupMenuItem({
      player_id: "kitchen",
      needs_setup: false,
      has_setup_flow: true,
    });

    expect(item?.label).toBe("reconfigure_player");
  });

  it("offers to configure and starts the flow for a setup-required player", () => {
    const item = getPlayerSetupMenuItem({
      player_id: "kitchen",
      needs_setup: true,
      has_setup_flow: false,
    });

    expect(item?.label).toBe("configure_player");
    item?.action?.();
    expect(storeMock.showFullscreenPlayer).toBe(false);
    expect(storeMock.showPlayersMenu).toBe(false);
    expect(emitEvent).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "player",
      playerId: "kitchen",
    });
  });
});

describe("getPlayerMenuItems power", () => {
  it("routes power changes through the group playback guard", () => {
    const player = makePlayer({
      power_control: "power",
      powered: true,
    });
    const powerItem = getPlayerMenuItems(player, undefined, {
      context: "player",
    }).find((item) => item.label === "power_off_player");

    powerItem?.action?.();

    expect(togglePlayerPower).toHaveBeenCalledWith(player);
  });
});

describe("getPlayerMenuItems settings shortcuts", () => {
  // the settings sections are reached from the settings page itself now, so these
  // menus only offer the way in
  const MOVED_TO_SETTINGS_PAGE = [
    "open_player_settings",
    "open_queue_settings",
    "open_dsp_settings",
    "player_options.open",
    "reconfigure_player",
    "configure_player",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockReturnValue(true);
    storeMock.showFullscreenPlayer = true;
    storeMock.showPlayersMenu = true;
  });

  it.each(["player", "queue"] as const)(
    "offers one way into the settings from the %s menu",
    (context) => {
      // a player that used to grow a shortcut for every one of these
      const menuItems = getPlayerMenuItems(
        makePlayer({
          has_setup_flow: true,
          options: [{ key: "eq", name: "EQ" } as PlayerOption],
        }),
        makeQueue(),
        { context },
      );
      const labels = menuItems.map((item) => item.label);

      expect(labels.filter((label) => label === "open_settings")).toEqual([
        "open_settings",
      ]);
      for (const moved of MOVED_TO_SETTINGS_PAGE) {
        expect(labels).not.toContain(moved);
      }
    },
  );

  it("opens the player settings page from the player menu", () => {
    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "player",
    });
    const settingsItem = openSettingsItem(menuItems);

    expect(settingsItem?.subItems).toBeUndefined();
    settingsItem?.action?.();

    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
    expect(storeMock.showFullscreenPlayer).toBe(false);
    expect(storeMock.showPlayersMenu).toBe(false);
  });

  it("picks a settings page from the fullscreen player", () => {
    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    const subItems = openSettingsItem(menuItems)?.subItems ?? [];

    expect(subItems.map((item) => item.label)).toEqual([
      "settings.queue_settings",
      "settings.player_settings",
      "settings.category.dsp",
    ]);
    for (const subItem of subItems) subItem.action?.();

    expect(routerPush.mock.calls.flat()).toEqual([
      "/settings/editqueue/kitchen",
      "/settings/editplayer/kitchen",
      "/settings/editplayer/kitchen/dsp",
    ]);
    expect(storeMock.showFullscreenPlayer).toBe(false);
    expect(storeMock.showPlayersMenu).toBe(false);
  });

  it("leaves out the DSP settings for a group player", () => {
    const menuItems = getPlayerMenuItems(
      makePlayer({ type: PlayerType.GROUP }),
      makeQueue(),
      { context: "queue" },
    );

    expect(
      openSettingsItem(menuItems)?.subItems?.map((item) => item.label),
    ).toEqual(["settings.queue_settings", "settings.player_settings"]);
  });

  it("leaves out the queue settings while playing from another source", () => {
    const menuItems = getPlayerMenuItems(makePlayer(), undefined, {
      context: "queue",
    });

    expect(
      openSettingsItem(menuItems)?.subItems?.map((item) => item.label),
    ).toEqual(["settings.player_settings", "settings.category.dsp"]);
  });

  it("keeps the settings out of a non-admin's menu", () => {
    isAdmin.mockReturnValue(false);

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "player",
    });

    expect(menuItems.map((item) => item.label)).not.toContain("open_settings");
  });
});

describe("getPlayerMenuItems play announcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    announcementAvailableRef.value = false;
  });

  it("omits the entry when no tts engine is set up", () => {
    const menuItems = getPlayerMenuItems(makePlayer(), undefined, {
      context: "player",
    });

    expect(menuItems.map((item) => item.label)).not.toContain(
      "play_announcement",
    );
  });

  it("omits the entry for a protocol player", () => {
    announcementAvailableRef.value = true;

    const menuItems = getPlayerMenuItems(
      makePlayer({ type: PlayerType.PROTOCOL }),
      undefined,
      { context: "player" },
    );

    expect(menuItems.map((item) => item.label)).not.toContain(
      "play_announcement",
    );
  });

  it("offers the entry for a player without native announcement support", () => {
    // the server falls back to its own implementation, so this is not gated on
    // PlayerFeature.PLAY_ANNOUNCEMENT
    announcementAvailableRef.value = true;

    const menuItems = getPlayerMenuItems(
      makePlayer({ supported_features: [] }),
      undefined,
      { context: "player" },
    );

    expect(menuItems.map((item) => item.label)).toContain("play_announcement");
  });

  it("opens the announcement dialog for the player from both menus", () => {
    announcementAvailableRef.value = true;
    const player = makePlayer();

    for (const context of ["player", "queue"] as const) {
      const menuItems = getPlayerMenuItems(player, makeQueue(), { context });
      const announcement = menuItems.find(
        (item) => item.label === "play_announcement",
      );

      expect(announcement).toBeDefined();
      announcement!.action!();
      expect(openAnnouncementDialog).toHaveBeenCalledWith("kitchen");
    }
  });
});

describe("getPlayerMenuItems ai dj", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiRadioAvailableRef.value = false;
    hostsRef.value = [];
    queueDjStatusRef.value = {};
    sessionsRef.value = [];
    showsRef.value = [];
  });

  it("omits the ai_dj entry without an available ai_radio provider", () => {
    hostsRef.value = [makeHost()];

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });

    expect(menuItems.map((item) => item.label)).not.toContain("ai_dj");
  });

  it("lists one entry per host plus an off entry when ai_radio is available", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [
      makeHost({ id: "host-1", name: "Robo DJ" }),
      makeHost({ id: "host-2", name: "Chill Casey" }),
    ];
    queueDjStatusRef.value = { kitchen: "host-1" };

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    const aiDj = menuItems.find((item) => item.label === "ai_dj");

    expect(aiDj?.subItems?.map((item) => item.label)).toEqual([
      "Robo DJ",
      "Chill Casey",
      "ai_dj_off",
    ]);
    expect(
      aiDj?.subItems?.find((item) => item.label === "Robo DJ")?.selected,
    ).toBe(true);
    expect(
      aiDj?.subItems?.find((item) => item.label === "Chill Casey")?.selected,
    ).toBe(false);
    expect(
      aiDj?.subItems?.find((item) => item.label === "ai_dj_off")?.selected,
    ).toBe(false);
  });

  it("checks the off entry when the queue has no dj host assigned", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost()];
    queueDjStatusRef.value = {};

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    const aiDj = menuItems.find((item) => item.label === "ai_dj");

    expect(
      aiDj?.subItems?.find((item) => item.label === "ai_dj_off")?.selected,
    ).toBe(true);
  });

  it("shows a single disabled row naming the show's host while a show is on air on this queue", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost({ id: "host-1", name: "Robo DJ" })];
    showsRef.value = [makeShow({ id: "show-1", host_id: "host-1" })];
    sessionsRef.value = [
      makeSession({ queue_id: "kitchen", station_id: "show-1" }),
    ];

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    const aiDj = menuItems.find((item) => item.label === "ai_dj_show_on_air");

    expect(aiDj).toBeDefined();
    expect(aiDj?.disabled).toBe(true);
    expect(aiDj?.subItems).toBeUndefined();
    expect(aiDj?.labelArgs).toEqual(["Robo DJ"]);
    expect(menuItems.map((item) => item.label)).not.toContain("ai_dj");
  });

  it("renders the normal hosts submenu when the running show is on a different queue", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost({ id: "host-1", name: "Robo DJ" })];
    showsRef.value = [makeShow({ id: "show-1", host_id: "host-1" })];
    sessionsRef.value = [
      makeSession({ queue_id: "other-queue", station_id: "show-1" }),
    ];

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    const aiDj = menuItems.find((item) => item.label === "ai_dj");

    expect(aiDj).toBeDefined();
    expect(aiDj?.subItems?.map((item) => item.label)).toEqual([
      "Robo DJ",
      "ai_dj_off",
    ]);
    expect(menuItems.map((item) => item.label)).not.toContain(
      "ai_dj_show_on_air",
    );
  });

  it("falls back to a nameless label when the on-air show's host can't be resolved", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [];
    showsRef.value = [makeShow({ id: "show-1", host_id: "deleted-host" })];
    sessionsRef.value = [
      makeSession({ queue_id: "kitchen", station_id: "show-1" }),
    ];

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    const aiDj = menuItems.find(
      (item) => item.label === "ai_dj_show_on_air_unknown",
    );

    expect(aiDj).toBeDefined();
    expect(aiDj?.disabled).toBe(true);
    expect(aiDj?.subItems).toBeUndefined();
    expect(aiDj?.labelArgs).toEqual([]);
    expect(menuItems.map((item) => item.label)).not.toContain("ai_dj");
  });

  it("assigns the clicked host as the queue's dj", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost({ id: "host-1", name: "Robo DJ" })];

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    menuItems
      .find((item) => item.label === "ai_dj")
      ?.subItems?.find((item) => item.label === "Robo DJ")
      ?.action?.();

    expect(setQueueDj).toHaveBeenCalledWith("kitchen", "host-1");
  });

  it("clears the queue's dj via the off entry", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost({ id: "host-1" })];
    queueDjStatusRef.value = { kitchen: "host-1" };

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    menuItems
      .find((item) => item.label === "ai_dj")
      ?.subItems?.find((item) => item.label === "ai_dj_off")
      ?.action?.();

    expect(setQueueDj).toHaveBeenCalledWith("kitchen", null);
  });

  it("reports a failed dj assignment instead of dropping the rejection", async () => {
    const { toast } = await import("vue-sonner");
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost({ id: "host-1", name: "Robo DJ" })];
    setQueueDj.mockRejectedValueOnce(new Error("Connection lost"));

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });
    await menuItems
      .find((item) => item.label === "ai_dj")
      ?.subItems?.find((item) => item.label === "Robo DJ")
      ?.action?.();

    expect(toast.error).toHaveBeenCalledWith("Connection lost");
  });

  it("omits the ai_dj entry outside the queue menu context", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost()];

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "player",
    });

    expect(menuItems.map((item) => item.label)).not.toContain("ai_dj");
  });

  it("lists ai_dj after select_source", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost()];
    const player = makePlayer({
      source_list: [
        playerSource({
          id: "kitchen",
          name: "Kitchen",
          passive: false,
          can_play_pause: true,
          can_seek: true,
          can_next_previous: true,
        }),
        playerSource({ id: "line_in", name: "Line-in", passive: false }),
      ],
      active_source: "kitchen",
    });

    const menuItems = getPlayerMenuItems(player, makeQueue(), {
      context: "queue",
    });
    const labels = menuItems.map((item) => item.label);

    expect(labels.indexOf("select_source")).toBeGreaterThan(-1);
    expect(labels.indexOf("ai_dj")).toBeGreaterThan(
      labels.indexOf("select_source"),
    );
  });

  it("refreshes hosts, dj status and session status when the ai_dj entry is built", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost()];

    getPlayerMenuItems(makePlayer(), makeQueue(), { context: "queue" });

    expect(loadHosts).toHaveBeenCalled();
    expect(loadQueueDjStatus).toHaveBeenCalled();
    expect(loadStatus).toHaveBeenCalled();
  });

  it("swallows a failed background refresh instead of rejecting unhandled", async () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost()];
    loadHosts.mockRejectedValueOnce(new Error("Connection lost"));
    loadQueueDjStatus.mockRejectedValueOnce(new Error("Connection lost"));
    loadStatus.mockRejectedValueOnce(new Error("Connection lost"));

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });

    // The rejections settle on a microtask; flushing here is what would
    // surface them as unhandled if the call sites didn't catch.
    await Promise.resolve();
    await Promise.resolve();
    expect(menuItems.map((item) => item.label)).toContain("ai_dj");
  });
});

describe("visualizer menu entry", () => {
  const VISUALIZER_LABEL = "settings.visualizer_enabled.label";

  it("is offered whatever the player plays over", () => {
    const player = makePlayer();
    api.players = { kitchen: player } as unknown as typeof api.players;

    const menuItems = getPlayerMenuItems(player, undefined, {
      context: "queue",
    });

    expect(menuItems.map((item) => item.label)).toContain(VISUALIZER_LABEL);
  });

  it("is a popout with all settings, targeting this player", () => {
    const player = makePlayer();
    api.players = { kitchen: player } as unknown as typeof api.players;

    const menuItems = getPlayerMenuItems(player, undefined, {
      context: "queue",
    });

    const entry = menuItems.find((item) => item.label === VISUALIZER_LABEL);
    expect(entry?.subComponent).toBeTruthy();
    expect(entry?.componentProps).toEqual({ playerId: player.player_id });
    // no toggle leaf: the on/off switch lives inside the popout
    expect(entry?.action).toBeUndefined();
  });
});

describe("shuffle and repeat", () => {
  const SPOTIFY = "spotify://audio_source/main";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** A player taken over by a live external source, as the server publishes it. */
  function playerOnSource(source: Partial<PlayerSource> = {}): Player {
    const live = playerSource({
      id: SPOTIFY,
      name: "Spotify Connect",
      ...source,
    });
    return makePlayer({ active_source: SPOTIFY, source_list: [live] });
  }

  function labels(player: Player, queue?: PlayerQueue): string[] {
    return getPlayerMenuItems(player, queue, { context: "queue" }).map(
      (item) => item.label,
    );
  }

  function entry(
    player: Player,
    label: string,
    queue?: PlayerQueue,
  ): ContextMenuItem | undefined {
    return getPlayerMenuItems(player, queue, { context: "queue" }).find(
      (item) => item.label === label,
    );
  }

  it("shuffles the queue when one is playing", () => {
    entry(makePlayer(), "shuffle_enable", makeQueue())?.action?.();

    expect(api.queueCommandShuffle).toHaveBeenCalledWith("kitchen", true);
    expect(api.playerCommandShuffle).not.toHaveBeenCalled();
  });

  it("shuffles a live source's own session through the player", () => {
    const player = playerOnSource({ can_shuffle: true });

    entry(player, "shuffle_enable")?.action?.();

    expect(api.playerCommandShuffle).toHaveBeenCalledWith("kitchen", true);
    expect(api.queueCommandShuffle).not.toHaveBeenCalled();
  });

  it("reads the shuffle state the source reports", () => {
    const player = playerOnSource({ can_shuffle: true, shuffle_enabled: true });

    entry(player, "shuffle_disable")?.action?.();

    expect(api.playerCommandShuffle).toHaveBeenCalledWith("kitchen", false);
  });

  // the menu can sit open while a websocket update lands; updates Object.assign
  // onto the player, so the click must act on what is true then, not at build
  it("shuffles against the state at click time, not at build time", () => {
    const player = playerOnSource({
      can_shuffle: true,
      shuffle_enabled: false,
    });
    const item = entry(player, "shuffle_enable");

    // the source list arrives as a fresh array on a player update
    player.source_list = [
      playerSource({
        id: SPOTIFY,
        name: "Spotify Connect",
        can_shuffle: true,
        shuffle_enabled: true,
      }),
    ];
    item?.action?.();

    expect(api.playerCommandShuffle).toHaveBeenCalledWith("kitchen", false);
  });

  it("shuffles the queue against the state at click time", () => {
    const queue = makeQueue({ shuffle_enabled: false });
    const item = entry(makePlayer(), "shuffle_enable", queue);

    queue.shuffle_enabled = true;
    item?.action?.();

    expect(api.queueCommandShuffle).toHaveBeenCalledWith("kitchen", false);
  });

  it("repeats within a live source's own session through the player", () => {
    const player = playerOnSource({ can_repeat: true });

    entry(player, "select_repeat_mode")?.subItems?.[1]?.action?.();

    expect(api.playerCommandRepeat).toHaveBeenCalledWith(
      "kitchen",
      RepeatMode.ALL,
    );
    expect(api.queueCommandRepeat).not.toHaveBeenCalled();
  });

  it("marks the repeat mode the source reports", () => {
    const player = playerOnSource({
      can_repeat: true,
      repeat_mode: RepeatMode.ONE,
    });

    const subItems = entry(player, "select_repeat_mode")?.subItems;

    expect(subItems?.map((item) => item.selected)).toEqual([
      false,
      false,
      true,
    ]);
  });

  // a source that cannot be reordered would accept the command and do nothing,
  // so it must not be offered at all
  it("offers neither for a source that cannot be reordered", () => {
    const shown = labels(playerOnSource());

    expect(shown).not.toContain("shuffle_enable");
    expect(shown).not.toContain("select_repeat_mode");
  });

  it("offers neither with nothing playing", () => {
    const shown = labels(makePlayer());

    expect(shown).not.toContain("shuffle_enable");
    expect(shown).not.toContain("select_repeat_mode");
  });

  // the MA queue sits in the source list under the player's own id
  it("never mistakes the player's own queue for a source", () => {
    const own = playerSource({
      id: "kitchen",
      can_shuffle: true,
      can_repeat: true,
    });
    const player = makePlayer({
      active_source: "kitchen",
      source_list: [own],
    });

    expect(labels(player)).not.toContain("shuffle_enable");
  });

  it("offers neither on a dynamic queue", () => {
    const shown = labels(makePlayer(), makeQueue({ is_dynamic: true }));

    expect(shown).not.toContain("shuffle_enable");
    expect(shown).not.toContain("select_repeat_mode");
  });
});
