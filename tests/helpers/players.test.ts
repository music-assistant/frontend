import {
  canBeGroupMember,
  canEditPlayerGroup,
  getPlayerGroupMemberCount,
  groupMemberPickerVisible,
  isBuiltinPlayer,
  isPlayerGrouped,
  isSelectablePlayer,
  playerVisible,
} from "@/helpers/players";
import {
  IdentifierType,
  type OutputProtocol,
  PlaybackState,
  type Player,
  PlayerFeature,
  PlayerType,
  type User,
  UserRole,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { user } from "../fixtures/user";
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
      software_version: null,
      model_id: null,
      manufacturer_id: null,
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
    private: false,
    icon: "speaker",
    power_control: "power",
    volume_control: "volume",
    mute_control: "mute",
    needs_setup: false,
    has_setup_flow: false,
    playback_state: PlaybackState.IDLE,
    output_protocols: [],
    active_output_protocol: null,
    elapsed_time: null,
    elapsed_time_last_updated: null,
    current_media: null,
    powered: null,
    volume_level: null,
    volume_muted: null,
    active_source: null,
    active_sound_mode: null,
    active_group: null,
    synced_to: null,
    sleep_timer_expires_at: null,
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
    protocol_domain: "test",
    priority: 0,
    available: true,
    derived_from: null,
    ...overrides,
  };
}

function createAdminUser(playerFilter: string[]): User {
  return user({
    user_id: "admin",
    username: "admin",
    role: UserRole.ADMIN,
    player_filter: playerFilter,
  });
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

  it("keeps an unavailable player hidden when it does not need setup", () => {
    const player = createPlayer({ available: false, needs_setup: false });

    expect(playerVisible(player, false, true)).toBe(false);
  });

  it("hides an unavailable player of this device", () => {
    const player = createPlayer({
      player_id: "local-web-player",
      available: false,
    });
    webPlayer.player_id = player.player_id;

    expect(playerVisible(player)).toBe(false);
  });

  it("hides a player that asks to be hidden", () => {
    expect(playerVisible(createPlayer({ hide_in_ui: true }))).toBe(false);
  });

  it("lists an audio input only where sources are opted in", () => {
    const player = createPlayer({ type: PlayerType.SOURCE });

    expect(playerVisible(player)).toBe(false);
    expect(playerVisible(player, false, false, true)).toBe(true);
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
  it("shows the private web player owned by this browser", () => {
    const player = createPlayer({
      player_id: "local-web-player",
      hide_in_ui: true,
      private: true,
    });
    webPlayer.player_id = player.player_id;

    expect(groupMemberPickerVisible(player)).toBe(true);
  });

  it("shows the private companion player owned by this app", () => {
    const player = createPlayer({
      player_id: "local-companion-player",
      hide_in_ui: true,
      private: true,
    });
    store.companionPlayerId = player.player_id;

    expect(groupMemberPickerVisible(player)).toBe(true);
  });

  it("shows a hidden player, so it can still be grouped", () => {
    expect(groupMemberPickerVisible(createPlayer({ hide_in_ui: true }))).toBe(
      true,
    );
  });

  it("keeps another device's private player out of the picker", () => {
    const player = createPlayer({
      player_id: "remote-web-player",
      hide_in_ui: true,
      private: true,
    });
    webPlayer.player_id = "local-web-player";

    expect(groupMemberPickerVisible(player)).toBe(false);
  });

  it("shows a private player once its owner unhides it", () => {
    const player = createPlayer({
      player_id: "remote-web-player",
      private: true,
    });
    webPlayer.player_id = "local-web-player";

    expect(groupMemberPickerVisible(player)).toBe(true);
  });
});

describe("canBeGroupMember", () => {
  it("offers a regular player", () => {
    expect(canBeGroupMember(createPlayer())).toBe(true);
  });

  it("offers a light, which joins a group without playing audio", () => {
    expect(canBeGroupMember(createPlayer({ type: PlayerType.LIGHT }))).toBe(
      true,
    );
  });

  it("offers a visualizer, which joins a group without playing audio", () => {
    expect(
      canBeGroupMember(createPlayer({ type: PlayerType.VISUALIZER })),
    ).toBe(true);
  });

  it("offers a metadata display, which joins a group without playing audio", () => {
    expect(canBeGroupMember(createPlayer({ type: PlayerType.DISPLAY }))).toBe(
      true,
    );
  });

  it("keeps a capture-only device out of the picker", () => {
    expect(canBeGroupMember(createPlayer({ type: PlayerType.UNKNOWN }))).toBe(
      false,
    );
    expect(canBeGroupMember(createPlayer({ type: PlayerType.SOURCE }))).toBe(
      false,
    );
  });
});

describe("isSelectablePlayer", () => {
  it("accepts a healthy regular player", () => {
    expect(isSelectablePlayer(createPlayer())).toBe(true);
  });

  it("rejects an audio input, even a fully set up one", () => {
    expect(isSelectablePlayer(createPlayer({ type: PlayerType.SOURCE }))).toBe(
      false,
    );
  });

  it("rejects a player that still needs setup", () => {
    expect(
      isSelectablePlayer(createPlayer({ available: false, needs_setup: true })),
    ).toBe(false);
  });

  it("rejects a missing player", () => {
    expect(isSelectablePlayer(undefined)).toBe(false);
  });
});

describe("player group controls", () => {
  it("allows editing when compatible players are available", () => {
    const player = createPlayer({
      supported_features: [PlayerFeature.SET_MEMBERS],
      can_group_with: ["office"],
    });

    expect(canEditPlayerGroup(player)).toBe(true);
  });

  it("allows removing dynamic members from an existing group", () => {
    const player = createPlayer({
      supported_features: [PlayerFeature.SET_MEMBERS],
      group_members: ["player", "office"],
    });

    expect(canEditPlayerGroup(player)).toBe(true);
  });

  it("does not allow editing a fully static group", () => {
    const player = createPlayer({
      supported_features: [PlayerFeature.SET_MEMBERS],
      group_members: ["player", "office"],
      static_group_members: ["office"],
    });

    expect(canEditPlayerGroup(player)).toBe(false);
  });

  it("counts the leader and unique children for regular players", () => {
    const player = createPlayer({
      group_members: ["player", "office", "office", "kitchen"],
    });

    expect(getPlayerGroupMemberCount(player)).toBe(3);
  });

  it("counts only children for dedicated group players", () => {
    const player = createPlayer({
      type: PlayerType.GROUP,
      group_members: ["office", "kitchen"],
    });

    expect(getPlayerGroupMemberCount(player)).toBe(2);
  });

  it("recognizes manual and dedicated groups", () => {
    expect(
      isPlayerGrouped(createPlayer({ group_members: ["player", "office"] })),
    ).toBe(true);
    expect(
      isPlayerGrouped(
        createPlayer({
          type: PlayerType.GROUP,
          group_members: ["office"],
        }),
      ),
    ).toBe(true);
    expect(isPlayerGrouped(createPlayer({ group_members: ["player"] }))).toBe(
      false,
    );
  });
});
