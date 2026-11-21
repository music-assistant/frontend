/**
 * Put players in the order of `playerIds`. Players missing from it follow at
 * the end in their given order, and ids without a player are skipped.
 */
export function keepPlayerOrder<T extends { player_id: string }>(
  players: readonly T[],
  playerIds: readonly string[],
): T[] {
  const position = new Map(
    playerIds.map((playerId, index) => [playerId, index]),
  );
  return players
    .map((player, index) => ({
      player,
      rank: position.get(player.player_id) ?? playerIds.length + index,
    }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ player }) => player);
}
