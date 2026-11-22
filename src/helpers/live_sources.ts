import { getMediaTypeIcon } from "@/helpers/media_type_icon";
import {
  MediaType,
  PlayerType,
  type Player,
  type PlayerSource,
} from "@/plugins/api/interfaces";
import { Bluetooth, Cable, Disc, Disc3, Tv, Usb } from "@lucide/vue";
import type { Component } from "vue";

// an input shows the icon of the first of these words in its name
const INPUT_ICONS: ReadonlyArray<[readonly string[], Component]> = [
  [["tv", "hdmi", "arc", "earc"], Tv],
  [["bluetooth"], Bluetooth],
  [["usb"], Usb],
  [["phono", "turntable", "vinyl", "record"], Disc3],
  [["cd"], Disc],
];

/**
 * The icon of a live source: what kind of input it is, such as TV or Line-in,
 * or the live source icon for one that is no input of a device.
 *
 * @param source - The entry in the list of live sources.
 */
export function getLiveSourceIcon(source: PlayerSource): Component {
  if (!source.is_input) return getMediaTypeIcon(MediaType.AUDIO_SOURCE)!;
  const words = source.name.toLowerCase().split(/[^a-z]+/);
  const match = INPUT_ICONS.find(([keys]) =>
    keys.some((key) => words.includes(key)),
  );
  return match?.[1] ?? Cable;
}

/**
 * The current name of the player a live source belongs to, shown below its
 * name; undefined for a source of no player, or of a device that is only an
 * input, whose name already is the name of that device.
 *
 * @param source - The entry in the list of live sources.
 * @param players - The players the app knows, by id.
 */
export function getLiveSourceOwnerName(
  source: PlayerSource,
  players: Readonly<Record<string, Player>>,
): string | undefined {
  const owner = source.owner_player_id
    ? players[source.owner_player_id]
    : undefined;
  if (!owner || owner.type === PlayerType.SOURCE) return undefined;
  return owner.name;
}

/**
 * The inputs a player can switch to, such as TV or Line-in.
 *
 * @param player - The player.
 */
export function getSelectableInputs(player: Player): PlayerSource[] {
  return player.source_list.filter(
    (source) => source.is_input && !source.passive,
  );
}

/**
 * Whether a player can switch to an input of its own, such as TV or Line-in.
 *
 * @param player - The player.
 */
export function hasSelectableInput(player: Player): boolean {
  // a player synced to another plays what that player plays
  return !player.synced_to && getSelectableInputs(player).length > 0;
}

/**
 * Whether there is anything to show on the Live sources page: a live source,
 * or a player with an input to switch to.
 *
 * @param hasLiveSources - Whether the user can start a live source on any player.
 * @param players - The players the app knows.
 */
export function liveSourcesAvailable(
  hasLiveSources: boolean,
  players: Iterable<Player>,
): boolean {
  return hasLiveSources || [...players].some(hasSelectableInput);
}

/**
 * The live sources sorted by name, and by the name of their player after that.
 *
 * @param sources - The entries in the list of live sources.
 * @param players - The players the app knows, by id.
 */
export function sortLiveSources(
  sources: readonly PlayerSource[],
  players: Readonly<Record<string, Player>>,
): PlayerSource[] {
  const ownerName = (source: PlayerSource) =>
    getLiveSourceOwnerName(source, players) ?? "";
  return [...sources].sort(
    (a, b) =>
      a.name.localeCompare(b.name) || ownerName(a).localeCompare(ownerName(b)),
  );
}

/**
 * The live sources whose name holds the search term, ignoring case.
 *
 * @param sources - The entries in the list of live sources.
 * @param term - The search term; an empty term matches nothing.
 */
export function matchLiveSources(
  sources: readonly PlayerSource[],
  term: string,
): PlayerSource[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  return sources.filter((source) => source.name.toLowerCase().includes(needle));
}
