export type PlayerGroupFilter = "all" | "players" | "lights" | "screens";

const PLAYER_GROUP_FILTERS: PlayerGroupFilter[] = [
  "all",
  "players",
  "lights",
  "screens",
];

export function isPlayerGroupFilter(
  value: unknown,
): value is PlayerGroupFilter {
  return (
    typeof value === "string" &&
    PLAYER_GROUP_FILTERS.includes(value as PlayerGroupFilter)
  );
}
