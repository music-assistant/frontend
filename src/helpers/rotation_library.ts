import { ONE_OF_OPERATOR } from "@/helpers/rotation_conditions";
import type {
  Album,
  ItemMapping,
  RotationStep,
} from "@/plugins/api/interfaces";

const IS_OPERATOR = "is";
const PICK_OPERATORS = [IS_OPERATOR, ONE_OF_OPERATOR];
const LIBRARY_ARTIST_URI = /^library:\/\/artist\/(\d+)$/;

/** The library artists a Keep step picks, and the album types it keeps. */
export interface PickedArtists {
  artistIds: string[];
  // undefined when the step keeps every album type
  albumTypes?: string[];
}

/** How many of an artist's albums on a provider are in the library. */
export interface AlbumCoverage {
  inLibrary: number;
  total: number;
}

/**
 * The library artists a filter step keeps by picking them, with the album
 * types it keeps alongside them.
 * @param step The step to read.
 * @returns The picks, or undefined when the step keeps no picked artist.
 */
export function pickedArtists(step: RotationStep): PickedArtists | undefined {
  if (step.type !== "filter" || step.mode !== "keep") return undefined;
  const artistIds: string[] = [];
  let albumTypes: string[] | undefined;
  for (const condition of step.conditions) {
    if (!PICK_OPERATORS.includes(condition.op)) continue;
    const values = pickedValues(condition.value);
    if (condition.field === "artist") {
      for (const value of values) {
        const id = libraryArtistId(value);
        if (id && !artistIds.includes(id)) artistIds.push(id);
      }
    } else if (condition.field === "album_type" && step.match === "all") {
      // under "any" another condition can let every other type through
      albumTypes = albumTypes
        ? albumTypes.filter((type) => values.includes(type))
        : values;
    }
  }
  if (artistIds.length === 0) return undefined;
  return albumTypes ? { artistIds, albumTypes } : { artistIds };
}

/**
 * The library id of a library artist uri.
 * @param uri The stored reference.
 * @returns The id, or undefined when the uri is no library artist.
 */
export function libraryArtistId(uri: string): string | undefined {
  return LIBRARY_ARTIST_URI.exec(uri)?.[1];
}

/**
 * How many of an artist's albums on a provider the library holds. An album
 * counts as held when a library album is mapped to the same item of the same
 * service.
 * @param providerAlbums The artist's albums on the provider.
 * @param libraryAlbums The artist's albums in the library.
 * @param albumTypes Only count these album types; every type when undefined.
 */
export function albumCoverage(
  providerAlbums: (Album | ItemMapping)[],
  libraryAlbums: Album[],
  albumTypes?: string[],
): AlbumCoverage {
  const held = new Set<string>();
  for (const album of libraryAlbums) {
    for (const mapping of album.provider_mappings ?? []) {
      held.add(mappingKey(mapping.provider_domain, mapping.item_id));
    }
  }
  let inLibrary = 0;
  let total = 0;
  for (const album of providerAlbums) {
    // a slim mapping names no service item to compare
    if (!("provider_mappings" in album)) continue;
    if (albumTypes && !albumTypes.includes(album.album_type)) continue;
    total += 1;
    const isHeld = album.provider_mappings.some((mapping) =>
      held.has(mappingKey(mapping.provider_domain, mapping.item_id)),
    );
    if (isHeld) inLibrary += 1;
  }
  return { inLibrary, total };
}

function pickedValues(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v): v is string => typeof v === "string" && v !== "");
}

function mappingKey(domain: string, itemId: string): string {
  return `${domain}\u0000${itemId}`;
}
