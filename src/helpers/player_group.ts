import {
  PLAYER_SECTIONS,
  type PlayerSectionKey,
} from "@/helpers/player_sections";

export type PlayerGroupFilter = "all" | PlayerSectionKey;

export function isPlayerGroupFilter(
  value: unknown,
): value is PlayerGroupFilter {
  return value === "all" || PLAYER_SECTIONS.some(({ key }) => key === value);
}
