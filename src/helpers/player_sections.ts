import { isScreenPlayer } from "@/helpers/players";
import { PlayerType } from "@/plugins/api/interfaces";

export type PlayerSectionKey = "players" | "lights" | "screens" | "inputs";

export interface PlayerSection<T> {
  key: PlayerSectionKey;
  // the translation key of its heading
  label: string;
  items: T[];
}

// the sections of the players settings list, in display order
const PLAYER_SECTIONS: readonly { key: PlayerSectionKey; label: string }[] = [
  { key: "players", label: "players" },
  { key: "lights", label: "lights" },
  { key: "screens", label: "screens" },
  { key: "inputs", label: "audio_inputs" },
];

/**
 * Split players into the sections of the players settings list, in the order
 * they are given. A section without players is left out.
 *
 * @param items - The players to list.
 * @param typeOf - Gives the type of a player.
 */
export function playerSections<T>(
  items: readonly T[],
  typeOf: (item: T) => PlayerType,
): PlayerSection<T>[] {
  return PLAYER_SECTIONS.map((section) => ({
    ...section,
    items: items.filter((item) => sectionOf(typeOf(item)) === section.key),
  })).filter((section) => section.items.length > 0);
}

// a type no other section lists, such as a group, is listed under the players
function sectionOf(type: PlayerType): PlayerSectionKey {
  if (type === PlayerType.LIGHT) return "lights";
  if (isScreenPlayer({ type })) return "screens";
  if (type === PlayerType.SOURCE) return "inputs";
  return "players";
}
