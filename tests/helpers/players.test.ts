import {
  groupMemberPickerVisible,
  isBuiltinPlayer,
  playerVisible,
} from "@/helpers/players";
import {
  IdentifierType,
  type OutputProtocol,
  type Player,
  PlayerType,
  type User,
  UserRole,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", () => ({
  store: { companionPlayerId: undefined, currentUser: undefined },
}));

vi.mock("@/plugins/web_player", () => ({
  webPlayer: { player_id: null },
  WebPlayerMode: {},
}));

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "player",
    provider: "test",
    type: PlayerType.PLAYER,
    name: "Player",
    available: true,
    device_info: {
      model: "Test",
      manufacturer: "Test",
      identifiers: {
        [IdentifierType.MAC_ADDRESS]: "",
        [IdentifierType.SERIAL_NUMBER]: "",
        [IdentifierType.UUID]: "",
        [IdentifierType.IP_ADDRESS]: "",
        [IdentifierType.UNKNOWN]: "",
      },
    },
    supported_features: [],
    can_group_with: [],
    enabled: true,
    group_members: [],
    static_group_members: [],
    source_list: [],
    sound_mode_list: [],
    options: [],
    group_volume: null,
    group_volume_muted: null,
    hide_in_ui: false,
    icon: "speaker",
    power_control: "power",
    volume_control: "volume",
    mute_control: "mute",
    needs_setup: false,
    output_protocols: [],
    active_output_protocol: null,
    ...overrides,
  };
}

function createOutputProtocol(
  overrides: Partial<OutputProtocol> = {},
): OutputProtocol {
  return {
    output_protocol_id: "native",
    name: "Native",
    is_native: true,
    protocol_domain: null,
    priority: 0,
    available: true,
    ...overrides,
  };
}

function createAdminUser(playerFilter: string[]): User {
  return {
    user_id: "admin",
    username: "admin",
    role: UserRole.ADMIN,
    enabled: true,
    created_at: "",
    preferences: {},
    provider_filter: [],
    player_filter: playerFilter,
  };
}

beforeEach(() => {
  store.companionPlayerId = undefined;
  store.currentUser = undefined;
  webPlayer.player_id = null;
});

describe("isBuiltinPlayer", () => {
  it("matches the web player of this browser", () => {
    const player = createPlayer({ player_id: "local-web-player" });
    webPlayer.player_id = player.player_id;

    expect(isBuiltinPlayer(player)).toBe(true);
  });

  it("matches the companion player of this app", () => {
    const player = createPlayer({ player_id: "local-companion-player" });
    store.companionPlayerId = player.player_id;

    expect(isBuiltinPlayer(player)).toBe(true);
  });

  it("matches a player that streams to the web player", () => {
    const player = createPlayer({
      output_protocols: [
        createOutputProtocol(),
        createOutputProtocol({ output_protocol_id: "local-web-player" }),
      ],
    });
    webPlayer.player_id = "local-web-player";

    expect(isBuiltinPlayer(player)).toBe(true);
  });

  it("matches a player that streams to the companion player", () => {
    const player = createPlayer({
      output_protocols: [
        createOutputProtocol({ output_protocol_id: "local-companion-player" }),
      ],
    });
    store.companionPlayerId = "local-companion-player";

    expect(isBuiltinPlayer(player)).toBe(true);
  });

  it("does not match a player of another device", () => {
    const player = createPlayer({
      player_id: "remote-player",
      output_protocols: [],
    });
    webPlayer.player_id = "local-web-player";
    store.companionPlayerId = "local-companion-player";

    expect(isBuiltinPlayer(player)).toBe(false);
  });
});

describe("playerVisible", () => {
  it("hides a disabled player", () => {
    expect(playerVisible(createPlayer({ enabled: false }))).toBe(false);
  });

  it("hides a synced player unless group childs are allowed", () => {
    const player = createPlayer({ synced_to: "leader-player" });

    expect(playerVisible(player)).toBe(false);
    expect(playerVisible(player, true)).toBe(true);
  });

  it("hides a group member unless group childs are allowed", () => {
    const player = createPlayer({ active_group: "group-player" });

    expect(playerVisible(player)).toBe(false);
    expect(playerVisible(player, true)).toBe(true);
  });

  it("hides an unavailable player", () => {
    expect(playerVisible(createPlayer({ available: false }))).toBe(false);
  });

  it("only shows a player that needs setup where setup can be launched", () => {
    const player = createPlayer({ available: false, needs_setup: true });

    expect(playerVisible(player)).toBe(false);
    expect(playerVisible(player, false, true)).toBe(true);
  });

  it("hides a player that asks to be hidden", () => {
    expect(playerVisible(createPlayer({ hide_in_ui: true }))).toBe(false);
  });

  it("shows the hidden player of this device", () => {
    const player = createPlayer({
      player_id: "local-web-player",
      hide_in_ui: true,
    });
    webPlayer.player_id = player.player_id;

    expect(playerVisible(player)).toBe(true);
  });

  it("hides a player that the user filtered out", () => {
    store.currentUser = createAdminUser(["other-player"]);

    expect(playerVisible(createPlayer({ player_id: "player" }))).toBe(false);
  });

  it("shows a player that the user filter includes", () => {
    store.currentUser = createAdminUser(["player"]);

    expect(playerVisible(createPlayer({ player_id: "player" }))).toBe(true);
  });

  it("shows all players when the user filter is empty", () => {
    store.currentUser = createAdminUser([]);

    expect(playerVisible(createPlayer({ player_id: "player" }))).toBe(true);
  });

  it("never filters out the web player of this browser", () => {
    const player = createPlayer({ player_id: "local-web-player" });
    webPlayer.player_id = player.player_id;
    store.currentUser = createAdminUser(["other-player"]);

    expect(playerVisible(player)).toBe(true);
  });
});

describe("groupMemberPickerVisible", () => {
  it("shows the hidden web player owned by this browser", () => {
    const player = createPlayer({
      player_id: "local-web-player",
      hide_in_ui: true,
    });
    webPlayer.player_id = player.player_id;

    expect(groupMemberPickerVisible(player)).toBe(true);
  });

  it("shows the hidden companion player owned by this app", () => {
    const player = createPlayer({
      player_id: "local-companion-player",
      hide_in_ui: true,
    });
    store.companionPlayerId = player.player_id;

    expect(groupMemberPickerVisible(player)).toBe(true);
  });

  it("keeps unrelated hidden players out of the picker", () => {
    const player = createPlayer({
      player_id: "remote-web-player",
      hide_in_ui: true,
    });
    webPlayer.player_id = "local-web-player";

    expect(groupMemberPickerVisible(player)).toBe(false);
  });
});
