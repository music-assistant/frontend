export function prioritizeSelectedPlayer<T extends { player_id: string }>(
  players: readonly T[],
  selectedPlayerId?: string,
): readonly T[] {
  if (!selectedPlayerId) return players;

  const selectedIndex = players.findIndex(
    (player) => player.player_id === selectedPlayerId,
  );
  if (selectedIndex <= 0) return players;

  return [
    players[selectedIndex],
    ...players.slice(0, selectedIndex),
    ...players.slice(selectedIndex + 1),
  ];
}
