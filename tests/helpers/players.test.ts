import { groupMemberPickerVisible } from "@/helpers/players";
import {
  IdentifierType,
  type Player,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", () => ({
  store: { companionPlayerId: undefined },
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

describe("groupMemberPickerVisible", () => {
  beforeEach(() => {
    store.companionPlayerId = undefined;
    webPlayer.player_id = null;
  });

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
