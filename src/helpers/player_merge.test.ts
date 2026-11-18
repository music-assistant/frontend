import {
  getMergeTargets,
  getSplittableProtocols,
} from "@/helpers/player_merge";
import {
  type PlayerProtocolInfo,
  PlayerType,
  ProtocolRole,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { outputProtocol } from "../../tests/fixtures/outputProtocol";

function protocol(
  protocolId: string,
  overrides: Partial<PlayerProtocolInfo> = {},
): PlayerProtocolInfo {
  return {
    protocol_id: protocolId,
    domain: protocolId,
    provider: protocolId,
    role: ProtocolRole.AUDIO,
    available: true,
    active: false,
    ...overrides,
  };
}

describe("getMergeTargets", () => {
  it("offers every other player that is not a group", () => {
    const players = [
      { player_id: "kitchen", type: PlayerType.PLAYER },
      { player_id: "kitchen-airplay", type: PlayerType.PLAYER },
      { player_id: "office", type: PlayerType.STEREO_PAIR },
      { player_id: "downstairs", type: PlayerType.GROUP },
    ];

    expect(
      getMergeTargets("kitchen", players).map((player) => player.player_id),
    ).toEqual(["kitchen-airplay", "office"]);
  });
});

describe("getSplittableProtocols", () => {
  it("offers each output of a player with more than one", () => {
    const player = {
      type: PlayerType.PLAYER,
      protocols: [
        protocol("sonos", { role: ProtocolRole.NATIVE }),
        protocol("airplay"),
      ],
      output_protocols: [],
    };

    expect(
      getSplittableProtocols(player).map((info) => info.protocol_id),
    ).toEqual(["sonos", "airplay"]);
  });

  it("leaves out an output that rides on another one", () => {
    const player = {
      type: PlayerType.PLAYER,
      protocols: [
        protocol("sonos", { role: ProtocolRole.NATIVE }),
        protocol("airplay"),
        protocol("sendspin"),
      ],
      output_protocols: [
        outputProtocol({ output_protocol_id: "airplay" }),
        outputProtocol({
          output_protocol_id: "sendspin",
          derived_from: "airplay",
        }),
      ],
    };

    expect(
      getSplittableProtocols(player).map((info) => info.protocol_id),
    ).toEqual(["sonos", "airplay"]);
  });

  it("offers nothing when only one output stands on its own", () => {
    const player = {
      type: PlayerType.PLAYER,
      protocols: [protocol("airplay"), protocol("sendspin")],
      output_protocols: [
        outputProtocol({ output_protocol_id: "airplay" }),
        outputProtocol({
          output_protocol_id: "sendspin",
          derived_from: "airplay",
        }),
      ],
    };

    expect(getSplittableProtocols(player)).toEqual([]);
  });

  it("offers nothing for a group", () => {
    const player = {
      type: PlayerType.GROUP,
      protocols: [
        protocol("sync_group", { role: ProtocolRole.VIRTUAL }),
        protocol("airplay"),
        protocol("chromecast"),
      ],
      output_protocols: [],
    };

    expect(getSplittableProtocols(player)).toEqual([]);
  });
});
