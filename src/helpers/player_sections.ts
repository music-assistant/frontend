import { isScreenPlayer } from "@/helpers/players";
import { PlayerType } from "@/plugins/api/interfaces";

export type PlayerSectionKey =
  "players" | "lights" | "screens" | "inputs" | "controllers";

export interface PlayerSectionKind {
  key: PlayerSectionKey;
  // the translation key of its heading
  label: string;
}

export interface PlayerSection<T> extends PlayerSectionKind {
  items: T[];
}

// the sections of the players settings list, in display order
export const PLAYER_SECTIONS: readonly PlayerSectionKind[] = [
  { key: "players", label: "players" },
  { key: "lights", label: "lights" },
  { key: "screens", label: "screens" },
  { key: "inputs", label: "audio_inputs" },
  { key: "controllers", label: "controllers" },
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
    items: items.filter(
      (item) => playerSectionOf(typeOf(item)) === section.key,
    ),
  })).filter((section) => section.items.length > 0);
}

/**
 * Return the section a player of the given type is listed in.
 *
 * @param type - The type of the player.
 */
export function playerSectionOf(type: PlayerType): PlayerSectionKey {
  if (type === PlayerType.LIGHT) return "lights";
  if (isScreenPlayer({ type })) return "screens";
  if (type === PlayerType.SOURCE) return "inputs";
  if (type === PlayerType.CONTROLLER) return "controllers";
  // a type no other section lists, such as a group, is listed under the players
  return "players";
}
