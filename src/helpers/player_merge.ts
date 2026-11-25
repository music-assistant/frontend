// Which players and outputs the settings offer to merge or split off. The server
// decides whether a merge or split is allowed and says why when it is not; these
// only leave out what can never apply.
import {
  type Player,
  type PlayerProtocolInfo,
  PlayerType,
  ProtocolRole,
} from "@/plugins/api/interfaces";

/** The players a player can be merged into: every other player that is not a group. */
export const getMergeTargets = function <
  T extends Pick<Player, "player_id" | "type">,
>(playerId: string, players: T[]): T[] {
  return players.filter(
    (player) =>
      player.player_id !== playerId && player.type !== PlayerType.GROUP,
  );
};

/**
 * The outputs of a player that can each be split off as a player of their own.
 * Empty when the player has nothing to split off.
 */
export const getSplittableProtocols = function (
  player: Pick<Player, "type" | "protocols" | "output_protocols">,
): PlayerProtocolInfo[] {
  if (player.type === PlayerType.GROUP) return [];
  // an output that rides on another one moves along with that one
  const riding = new Set(
    player.output_protocols
      .filter((output) => output.derived_from)
      .map((output) => output.output_protocol_id),
  );
  const protocols = player.protocols.filter(
    (protocol) =>
      protocol.role !== ProtocolRole.VIRTUAL &&
      !riding.has(protocol.protocol_id),
  );
  // splitting off the only output would leave the player without one
  return protocols.length > 1 ? protocols : [];
};
