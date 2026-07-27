import { getPlayerSetupMenuItem } from "@/helpers/player_menu_items";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emitEvent, storeMock } = vi.hoisted(() => ({
  emitEvent: vi.fn(),
  storeMock: {
    showFullscreenPlayer: true,
    showPlayersMenu: true,
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {},
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isAdmin: () => false,
  },
}));

vi.mock("@/plugins/router", () => ({
  default: {
    push: vi.fn(),
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
