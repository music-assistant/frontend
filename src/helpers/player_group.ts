export type PlayerGroupFilter = "all" | "players" | "lights" | "visualizers";

const PLAYER_GROUP_FILTERS: PlayerGroupFilter[] = [
  "all",
  "players",
  "lights",
  "visualizers",
];

export function isPlayerGroupFilter(
  value: unknown,
): value is PlayerGroupFilter {
  return (
    typeof value === "string" &&
    PLAYER_GROUP_FILTERS.includes(value as PlayerGroupFilter)
  );
}
