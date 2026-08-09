import {
  getPlayerMenuItems,
  getPlayerSetupMenuItem,
} from "@/helpers/player_menu_items";
import {
  PLAYER_CONTROL_NONE,
  PlayerType,
  type AIRadioHost,
  type Player,
  type PlayerQueue,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";

const {
  aiRadioAvailableRef,
  emitEvent,
  hostsRef,
  isAdmin,
  loadHosts,
  loadQueueDjStatus,
  queueDjStatusRef,
  routerPush,
  setQueueDj,
  storeMock,
} = vi.hoisted(() => ({
  aiRadioAvailableRef: { value: false },
  emitEvent: vi.fn(),
  hostsRef: { value: [] as AIRadioHost[] },
  isAdmin: vi.fn(),
  loadHosts: vi.fn(),
  loadQueueDjStatus: vi.fn(),
  queueDjStatusRef: { value: {} as Record<string, string> },
  routerPush: vi.fn(),
  setQueueDj: vi.fn(),
  storeMock: {
    showFullscreenPlayer: true,
    showPlayersMenu: true,
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    players: {},
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

vi.mock("@/helpers/sleep_timer", () => ({
  getSleepTimerMenuItem: vi.fn(),
  sleepTimerActive: () => false,
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

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "kitchen",
    type: PlayerType.PLAYER,
    power_control: PLAYER_CONTROL_NONE,
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

function makeHost(overrides: Partial<AIRadioHost> = {}): AIRadioHost {
  return {
    id: "host-1",
    name: "Robo DJ",
    instructions: "",
    tts_engine: "",
    section_ids: [],
    section_order: [],
    merge_section_id: "",
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

describe("getPlayerMenuItems settings shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockReturnValue(true);
    storeMock.showFullscreenPlayer = true;
    storeMock.showPlayersMenu = true;
  });

  it("shows both settings shortcuts in the fullscreen queue menu", () => {
    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "queue",
    });

    expect(menuItems.map((item) => item.label)).toEqual(
      expect.arrayContaining(["open_queue_settings", "open_player_settings"]),
    );
  });

  it("shows queue settings in the player menu only for an active MA queue", () => {
    const activeQueueItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "player",
    });
    const externalSourceItems = getPlayerMenuItems(makePlayer(), undefined, {
      context: "player",
    });

    expect(activeQueueItems.map((item) => item.label)).toContain(
      "open_queue_settings",
    );
    expect(externalSourceItems.map((item) => item.label)).not.toContain(
      "open_queue_settings",
    );
  });

  it("opens the settings page for each shortcut", () => {
    const menuItems = getPlayerMenuItems(
      makePlayer(),
      makeQueue({ queue_id: "source-queue" }),
      { context: "player" },
    );

    menuItems.find((item) => item.label === "open_queue_settings")?.action?.();
    expect(routerPush).toHaveBeenCalledWith("/settings/editqueue/source-queue");

    menuItems.find((item) => item.label === "open_player_settings")?.action?.();
    expect(routerPush).toHaveBeenCalledWith("/settings/editplayer/kitchen");
    expect(storeMock.showFullscreenPlayer).toBe(false);
    expect(storeMock.showPlayersMenu).toBe(false);
  });
});

describe("getPlayerMenuItems ai dj", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiRadioAvailableRef.value = false;
    hostsRef.value = [];
    queueDjStatusRef.value = {};
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

  it("omits the ai_dj entry outside the queue menu context", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost()];

    const menuItems = getPlayerMenuItems(makePlayer(), makeQueue(), {
      context: "player",
    });

    expect(menuItems.map((item) => item.label)).not.toContain("ai_dj");
  });

  it("refreshes hosts and dj status when the ai_dj submenu is built", () => {
    aiRadioAvailableRef.value = true;
    hostsRef.value = [makeHost()];

    getPlayerMenuItems(makePlayer(), makeQueue(), { context: "queue" });

    expect(loadHosts).toHaveBeenCalled();
    expect(loadQueueDjStatus).toHaveBeenCalled();
  });
});
