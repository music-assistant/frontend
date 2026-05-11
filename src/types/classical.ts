// Types for the Classical model (Work / Credit / roles).
//
// Hand-written placeholders until the music-assistant-models package
// publishes TypeScript bindings. Field names match the upstream model so
// the swap is a one-line import change.

import type { ItemMapping, MediaItem } from "@/plugins/api/interfaces";

export enum ArtistRole {
  MAIN_ARTIST = "main_artist",
  COMPOSER = "composer",
  LYRICIST = "lyricist",
  ARRANGER = "arranger",
  CONDUCTOR = "conductor",
  ORCHESTRA = "orchestra",
  ENSEMBLE = "ensemble",
  CHOIR = "choir",
  SOLOIST = "soloist",
  PERFORMER = "performer",
}

export enum WorkType {
  SYMPHONY = "symphony",
  CONCERTO = "concerto",
  SONATA = "sonata",
  SUITE = "suite",
  OPERA = "opera",
  ORATORIO = "oratorio",
  CANTATA = "cantata",
  MASS = "mass",
  SONG_CYCLE = "song_cycle",
  QUARTET = "quartet",
  OVERTURE = "overture",
  BALLET = "ballet",
  OTHER = "other",
}

// The WORK media type isn't in the shared MediaType enum yet; once the
// backend adds it, this constant and the Omit in Work below can go.
export const WORK_MEDIA_TYPE = "work" as const;

export interface Credit {
  artist: ItemMapping;
  role: ArtistRole;
  instrument: string | null;
  position: number;
}

export interface Work extends Omit<MediaItem, "media_type"> {
  media_type: typeof WORK_MEDIA_TYPE;
  composers: ItemMapping[];
  catalog_numbers: string[];
  work_type: WorkType | null;
  parent_work: ItemMapping | null;
  arrangement_of: ItemMapping[];
}

export const PERFORMER_ROLES: readonly ArtistRole[] = [
  ArtistRole.CONDUCTOR,
  ArtistRole.ORCHESTRA,
  ArtistRole.ENSEMBLE,
  ArtistRole.CHOIR,
  ArtistRole.SOLOIST,
  ArtistRole.PERFORMER,
];
