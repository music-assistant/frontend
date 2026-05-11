// Service layer for the Classical view.
//
// Method signatures track the upcoming Stage 3 WebSocket API. Until that
// lands, every call reads from the JSON fixtures under src/fixtures/classical/.
// Flip USE_MOCKS to false once the backend ships.

import {
  ImageType,
  MediaType,
  type Artist,
  type ItemMapping,
  type MediaItemImage,
  type Track,
} from "@/plugins/api/interfaces";
import { ArtistRole, PERFORMER_ROLES } from "@/types/classical";

import composersFixture from "@/fixtures/classical/composers.json";
import performersFixture from "@/fixtures/classical/performers.json";
import recordingsFixture from "@/fixtures/classical/recordings.json";
import worksFixture from "@/fixtures/classical/works.json";

// TODO: set to false and verify every call returns the expected shape once
// the WebSocket controllers are wired. Once stable, this flag and the
// fixture imports above can be removed entirely.
const USE_MOCKS = true;

export interface ListOpts {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: string;
}

export interface ClassicalComposer {
  item_id: string;
  name: string;
  sort_name?: string;
  year_range?: string;
  work_count: number;
  recording_count: number;
  fanart_url?: string | null;
  thumbnail_url?: string | null;
  logo_url?: string | null;
  biography?: string;
}

export interface ClassicalWorkSummary {
  item_id: string;
  name: string;
  composer: string;
  composer_id: string;
  catalog_number?: string;
  work_type?: string;
  year_composed?: number | null;
  recording_count: number;
  arrangement_of?: Array<{ item_id: string; name: string; composer: string }>;
}

export interface ClassicalPerformer {
  item_id: string;
  name: string;
  role: ArtistRole | string;
  year_range?: string;
  recording_count: number;
  work_count: number;
  fanart_url?: string | null;
  thumbnail_url?: string | null;
  logo_url?: string | null;
  biography?: string | null;
}

export interface ClassicalRecordingMovement {
  track_id: string;
  title: string;
  duration_seconds: number;
}

// Mock-shaped credit. When the backend ships Credit[] (artist: ItemMapping,
// role, instrument, position), this maps trivially — only the artist field
// becomes a full ItemMapping instead of a bare id.
export interface ClassicalCreditRecord {
  artist_id: string;
  role: ArtistRole | string;
  instrument?: string | null;
  position: number;
}

export interface ClassicalRecording {
  item_id: string;
  work_id: string;
  // Legacy flat fields kept for back-compat with WorkRecordingCard's display
  // text. Derived from `credits` when both are present; prefer credits.
  conductor?: string;
  conductor_id?: string;
  orchestra?: string;
  orchestra_id?: string;
  performer_ids?: string[];
  // Full credits list for menu builders and aggregations.
  credits?: ClassicalCreditRecord[];
  year?: number;
  duration_seconds: number;
  source_album?: string;
  source_album_id?: string;
  movements: ClassicalRecordingMovement[];
}

// ---------------------------------------------------------------------------
// Library-level signals
// ---------------------------------------------------------------------------

// Drives the greyed-out state of the Classical nav entry. The real
// implementation will report whether the library contains any Work entity
// or any track tagged as classical.
export async function hasClassicalContent(): Promise<boolean> {
  if (USE_MOCKS) {
    return (
      composersFixture.length > 0 ||
      worksFixture.length > 0 ||
      performersFixture.length > 0
    );
  }
  throw new Error("hasClassicalContent: real backend not wired yet");
}

// ---------------------------------------------------------------------------
// Composers
// ---------------------------------------------------------------------------

export async function getComposers(
  _opts: ListOpts = {},
): Promise<ClassicalComposer[]> {
  if (USE_MOCKS) return composersFixture as ClassicalComposer[];
  throw new Error("getComposers: real backend not wired yet");
}

export async function getComposer(
  id: string,
): Promise<ClassicalComposer | undefined> {
  if (USE_MOCKS) {
    return (composersFixture as ClassicalComposer[]).find(
      (c) => c.item_id === id,
    );
  }
  throw new Error("getComposer: real backend not wired yet");
}

export async function getComposerWorks(
  composerId: string,
  _opts: ListOpts = {},
): Promise<ClassicalWorkSummary[]> {
  if (USE_MOCKS) {
    return (worksFixture as ClassicalWorkSummary[]).filter(
      (w) => w.composer_id === composerId,
    );
  }
  throw new Error("getComposerWorks: real backend not wired yet");
}

// ---------------------------------------------------------------------------
// Works
// ---------------------------------------------------------------------------

export async function getWorks(
  _opts: ListOpts = {},
): Promise<ClassicalWorkSummary[]> {
  if (USE_MOCKS) return worksFixture as ClassicalWorkSummary[];
  throw new Error("getWorks: real backend not wired yet");
}

export async function getWork(
  id: string,
): Promise<ClassicalWorkSummary | undefined> {
  if (USE_MOCKS) {
    return (worksFixture as ClassicalWorkSummary[]).find(
      (w) => w.item_id === id,
    );
  }
  throw new Error("getWork: real backend not wired yet");
}

export async function getWorkRecordings(
  workId: string,
  filterByArtistId?: string,
): Promise<ClassicalRecording[]> {
  if (USE_MOCKS) {
    const all = (recordingsFixture as ClassicalRecording[]).filter(
      (r) => r.work_id === workId,
    );
    if (!filterByArtistId) return all;
    return all.filter(
      (r) =>
        r.conductor_id === filterByArtistId ||
        r.orchestra_id === filterByArtistId ||
        r.performer_ids?.includes(filterByArtistId),
    );
  }
  throw new Error("getWorkRecordings: real backend not wired yet");
}

// ---------------------------------------------------------------------------
// Performers
// ---------------------------------------------------------------------------

export async function getPerformers(
  opts: ListOpts & { role?: ArtistRole } = {},
): Promise<ClassicalPerformer[]> {
  if (USE_MOCKS) {
    // Lyricists/arrangers are credits but not performers; exclude them at the
    // service boundary so callers (and the "All" chip in PerformersTab) never
    // have to worry about leaking non-performer roles into performer UI.
    const all = (performersFixture as ClassicalPerformer[]).filter((p) =>
      PERFORMER_ROLES.includes(p.role as ArtistRole),
    );
    if (!opts.role) return all;
    return all.filter((p) => p.role === opts.role);
  }
  throw new Error("getPerformers: real backend not wired yet");
}

export async function getPerformer(
  id: string,
): Promise<ClassicalPerformer | undefined> {
  if (USE_MOCKS) {
    return (performersFixture as ClassicalPerformer[]).find(
      (p) => p.item_id === id,
    );
  }
  throw new Error("getPerformer: real backend not wired yet");
}

export async function getPerformerWorks(
  performerId: string,
): Promise<ClassicalWorkSummary[]> {
  if (USE_MOCKS) {
    const workIds = new Set(
      (recordingsFixture as ClassicalRecording[])
        .filter(
          (r) =>
            r.conductor_id === performerId ||
            r.orchestra_id === performerId ||
            r.performer_ids?.includes(performerId),
        )
        .map((r) => r.work_id),
    );
    return (worksFixture as ClassicalWorkSummary[]).filter((w) =>
      workIds.has(w.item_id),
    );
  }
  throw new Error("getPerformerWorks: real backend not wired yet");
}

// ---------------------------------------------------------------------------
// InfoHeader synthesis
// ---------------------------------------------------------------------------

/**
 * Build an Artist-shaped MediaItem so InfoHeader can render a classical
 * entity (composer, performer, work) using the existing artist-detail
 * layout. The "http" image provider bypasses the provider-availability
 * filter in getMediaItemImage and the imageproxy in getMediaItemImageUrl,
 * so the supplied URLs are used directly.
 *
 * Drops out once the backend returns proper Artist records for composers
 * and performers.
 */
export interface SynthesiseArtistInput {
  id: string;
  name: string;
  uri?: string;
  fanart_url?: string | null;
  thumbnail_url?: string | null;
  logo_url?: string | null;
  biography?: string | null;
}

export function synthesiseArtist(input: SynthesiseArtistInput): Artist {
  const fanart = input.fanart_url ?? undefined;
  const thumb = input.thumbnail_url ?? input.fanart_url ?? undefined;
  const logo = input.logo_url ?? undefined;
  const makeImage = (type: ImageType, path: string): MediaItemImage => ({
    type,
    path,
    provider: "http",
    remotely_accessible: true,
  });
  const images: MediaItemImage[] = [];
  if (thumb) images.push(makeImage(ImageType.THUMB, thumb));
  if (fanart) images.push(makeImage(ImageType.FANART, fanart));
  if (logo) images.push(makeImage(ImageType.LOGO, logo));

  return {
    item_id: input.id,
    provider: "library",
    name: input.name,
    uri: input.uri ?? `library://artist/${input.id}`,
    is_playable: true,
    media_type: MediaType.ARTIST,
    provider_mappings: [
      {
        item_id: input.id,
        provider_domain: "library",
        provider_instance: "library",
        available: true,
        in_library: true,
      },
    ],
    metadata: {
      description: input.biography ?? undefined,
      images,
    },
    favorite: false,
    timestamp_added: 0,
    timestamp_modified: 0,
  };
}

/**
 * Build a Track-shaped MediaItem from a movement plus its enclosing recording
 * / work / composer / performers so the standard context-menu builders
 * accept the row. Synthetic URIs do not resolve on the backend, so play /
 * favourite / playlist actions are visually present but no-op.
 *
 * TODO: remove once movements are delivered as real Track records by the
 * backend; callers will then pass the Track directly to the menu helpers.
 */
export function synthesiseTrack(
  movement: ClassicalRecordingMovement,
  recording: ClassicalRecording,
  composer: ClassicalComposer | undefined,
  performers: ClassicalPerformer[],
  trackNumber = 1,
): Track {
  const composerMapping = composer ? performerToMapping(composer) : undefined;
  const performerMappings = performers.map(performerToMapping);
  // Multiple artists disable the standard "Go to artist" entry — classical
  // credits surface via the performer submenu instead.
  const artists: ItemMapping[] = composerMapping
    ? [composerMapping, ...performerMappings]
    : performerMappings;

  const album: ItemMapping = {
    item_id: recording.source_album_id ?? recording.item_id,
    provider: "library",
    name: recording.source_album ?? "",
    uri: `library://album/${recording.source_album_id ?? recording.item_id}`,
    available: true,
    is_playable: true,
    media_type: MediaType.ALBUM,
  };

  return {
    item_id: movement.track_id,
    provider: "library",
    name: movement.title,
    uri: `library://track/${movement.track_id}`,
    is_playable: true,
    media_type: MediaType.TRACK,
    duration: movement.duration_seconds,
    artists,
    album,
    track_number: trackNumber,
    provider_mappings: [
      {
        item_id: movement.track_id,
        provider_domain: "library",
        provider_instance: "library",
        available: true,
        in_library: true,
      },
    ],
    metadata: {},
    favorite: false,
    timestamp_added: 0,
    timestamp_modified: 0,
  };
}

// Helper used by detail views that need to resolve performer ids referenced
// from a recording's credits into full ClassicalPerformer records.
export function makePerformerLookup(
  performers: ClassicalPerformer[],
): Record<string, ClassicalPerformer> {
  const out: Record<string, ClassicalPerformer> = {};
  for (const p of performers) out[p.item_id] = p;
  return out;
}

function performerToMapping(p: { item_id: string; name: string }): ItemMapping {
  return {
    item_id: p.item_id,
    provider: "library",
    name: p.name,
    uri: `library://artist/${p.item_id}`,
    available: true,
    is_playable: true,
    media_type: MediaType.ARTIST,
  };
}
