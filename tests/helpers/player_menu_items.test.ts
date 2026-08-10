import {
  getPlayerMenuItems,
  getPlayerSetupMenuItem,
} from "@/helpers/player_menu_items";
import {
  PLAYER_CONTROL_NONE,
  PlayerType,
  type Player,
  type PlayerQueue,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";

const { emitEvent, isAdmin, routerPush, storeMock } = vi.hoisted(() => ({
  emitEvent: vi.fn(),
  isAdmin: vi.fn(),
  routerPush: vi.fn(),
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
