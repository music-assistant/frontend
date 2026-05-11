// Context-menu construction for classical row items.
//
// Each row is wrapped in a synthesised Track-shaped MediaItem and passed
// through the standard menu builders (getPlaybackContextMenuItems +
// getContextMenuItems), then classical-specific entries — Go to composer /
// work / performer submenu — are spliced in adjacent to Go to album. In
// mock mode the synthetic URIs don't resolve on the backend, so actions
// are visually present but no-op.

import {
  getContextMenuItems,
  getPlaybackContextMenuItems,
  type ContextMenuItem,
} from "@/layouts/default/ItemContextMenu.vue";
import api from "@/plugins/api";
import { QueueOption, type Track } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { i18n } from "@/plugins/i18n";
import {
  synthesiseTrack,
  type ClassicalComposer,
  type ClassicalCreditRecord,
  type ClassicalPerformer,
  type ClassicalRecording,
  type ClassicalRecordingMovement,
  type ClassicalWorkSummary,
} from "@/services/classical";
import { ArtistRole } from "@/types/classical";
import type { Router } from "vue-router";

const ROLE_PRIORITY: ArtistRole[] = [
  ArtistRole.CONDUCTOR,
  ArtistRole.ENSEMBLE,
  ArtistRole.ORCHESTRA,
  ArtistRole.CHOIR,
  ArtistRole.SOLOIST,
  ArtistRole.PERFORMER,
];

const NON_COMPOSER_ROLES = new Set<string>([
  ArtistRole.CONDUCTOR,
  ArtistRole.ENSEMBLE,
  ArtistRole.ORCHESTRA,
  ArtistRole.CHOIR,
  ArtistRole.SOLOIST,
  ArtistRole.PERFORMER,
]);

const ROLE_LABEL: Record<string, string> = {
  [ArtistRole.CONDUCTOR]: "conductor",
  [ArtistRole.ENSEMBLE]: "ensemble",
  [ArtistRole.ORCHESTRA]: "orchestra",
  [ArtistRole.CHOIR]: "choir",
  [ArtistRole.SOLOIST]: "soloist",
  [ArtistRole.PERFORMER]: "performer",
};

export interface ClassicalMenuContext {
  router: Router;
  work: ClassicalWorkSummary;
  composer?: ClassicalComposer;
  performerLookup: Record<string, ClassicalPerformer>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function openMovementMenu(
  movement: ClassicalRecordingMovement,
  recording: ClassicalRecording,
  ctx: ClassicalMenuContext,
  evt: Event | MouseEvent,
) {
  const performers = creditedPerformers(recording, ctx);
  const track = synthesiseTrack(
    movement,
    recording,
    ctx.composer,
    performers,
    movementIndex(movement, recording) + 1,
  );
  const items = await buildMenuItems({
    tracks: [track],
    recording,
    ctx,
    includeRemoveFromLibrary: true,
    includeMoreInfo: true,
  });
  emit(items, evt);
}

export async function openRecordingMenu(
  recording: ClassicalRecording,
  ctx: ClassicalMenuContext,
  evt: Event | MouseEvent,
) {
  const performers = creditedPerformers(recording, ctx);
  // Pass the full array of synthesised movement tracks. The standard
  // builders' multi-item path emits per-track operations under each menu
  // action — that's how recording-level multi-write (favourite/add to
  // playlist/link to genre) lands as N writes on the backend.
  const tracks = recording.movements.map((m, i) =>
    synthesiseTrack(m, recording, ctx.composer, performers, i + 1),
  );
  const items = await buildMenuItems({
    tracks,
    recording,
    ctx,
    // The recording menu omits Remove from library and Show info.
    includeRemoveFromLibrary: false,
    includeMoreInfo: false,
  });
  emit(items, evt);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface BuildArgs {
  tracks: Track[];
  recording: ClassicalRecording;
  ctx: ClassicalMenuContext;
  includeRemoveFromLibrary: boolean;
  includeMoreInfo: boolean;
}

async function buildMenuItems({
  tracks,
  recording,
  ctx,
  includeRemoveFromLibrary,
  includeMoreInfo,
}: BuildArgs): Promise<ContextMenuItem[]> {
  // parentItem is intentionally undefined — the synthetic album mapping
  // isn't a full Album record, which would otherwise enable "play X from
  // here". TODO: pass the resolved Album once real Track records arrive.
  let playItems = await getPlaybackContextMenuItems(tracks);
  // getPlaybackContextMenuItems gates entries behind itemIsAvailable, which
  // synthetic tracks fail; the fallback keeps the play + enqueue submenu
  // visible. Drops out automatically once tracks pass availability.
  if (playItems.length === 0) playItems = fallbackPlayItems(tracks);
  const standardItems = await getContextMenuItems(tracks);

  // Filtering rules:
  //  - goto_artist is replaced by the Go to performer submenu.
  //  - remove_library / show_info are omitted from the recording menu.
  //  - refresh_item: TODO remove this branch once mocks are gone. The
  //    standard machinery only adds it when itemIsAvailable returns false,
  //    which only happens for synthetic tracks.
  const filtered = standardItems.filter((item) => {
    if (item.label === "goto_artist") return false;
    if (item.label === "refresh_item") return false;
    if (!includeRemoveFromLibrary && item.label === "remove_library")
      return false;
    if (!includeMoreInfo && item.label === "show_info") return false;
    return true;
  });

  // Splice classical entries after Go to album. When goto_album is missing
  // (synthetic tracks fail itemIsAvailable in mock mode) drop them at the
  // front of the standard block so they still appear near the top.
  const classicalEntries: ContextMenuItem[] = [
    gotoComposer(ctx),
    gotoWork(ctx),
    performerSubMenu(recording, ctx),
  ].filter((x): x is ContextMenuItem => x !== null);
  const albumIdx = filtered.findIndex((i) => i.label === "goto_album");
  if (albumIdx >= 0) {
    filtered.splice(albumIdx + 1, 0, ...classicalEntries);
  } else {
    filtered.unshift(...classicalEntries);
  }

  // Movement menu: ensure Show info is present (gated by itemIsAvailable
  // upstream). Unshifted after classical entries so it lands first.
  if (includeMoreInfo && !filtered.some((i) => i.label === "show_info")) {
    filtered.unshift(showInfoEntry(tracks[0], ctx.router));
  }

  // Favourites entry sits directly above Add to playlist. Lifted from its
  // upstream position (or injected when itemIsAvailable suppressed it).
  reorderFavourites(filtered);

  return [...playItems, ...filtered];
}

// Lift favourites_add / favorites_remove to sit directly above add_playlist,
// or inject a placeholder when itemIsAvailable suppressed the upstream entry.
function reorderFavourites(items: ContextMenuItem[]) {
  const favouriteIndices: number[] = [];
  items.forEach((item, i) => {
    if (item.label === "favorites_add" || item.label === "favorites_remove")
      favouriteIndices.push(i);
  });

  const favourites = favouriteIndices.length
    ? favouriteIndices
        .reverse()
        .map((i) => items.splice(i, 1)[0])
        .reverse()
    : [favouriteAddEntry()];

  const playlistIdx = items.findIndex((i) => i.label === "add_playlist");
  if (playlistIdx >= 0) items.splice(playlistIdx, 0, ...favourites);
  else items.push(...favourites);
}

function emit(items: ContextMenuItem[], evt: Event | MouseEvent) {
  if (items.length === 0) return;
  const mouseEvt = evt as MouseEvent;
  eventbus.emit("contextmenu", {
    items,
    posX: mouseEvt.clientX ?? 0,
    posY: mouseEvt.clientY ?? 0,
    showPlayMenuHeader: true,
  });
}

function gotoComposer(ctx: ClassicalMenuContext): ContextMenuItem | null {
  if (!ctx.composer) return null;
  return {
    label: "classical_goto_composer",
    labelArgs: [ctx.composer.name],
    icon: "mdi-account-music",
    action: () =>
      ctx.router.push(`/classical/composers/${ctx.composer!.item_id}`),
  };
}

function gotoWork(ctx: ClassicalMenuContext): ContextMenuItem {
  return {
    label: "classical_goto_work",
    labelArgs: [ctx.work.name],
    icon: "mdi-music",
    action: () => ctx.router.push(`/classical/works/${ctx.work.item_id}`),
  };
}

function performerSubMenu(
  recording: ClassicalRecording,
  ctx: ClassicalMenuContext,
): ContextMenuItem | null {
  const grouped = aggregateCredits(recording, ctx);
  if (grouped.length === 0) return null;
  return {
    label: "classical_goto_performer",
    labelArgs: [],
    icon: "mdi-account-music",
    subItems: grouped.map((g) =>
      performerSubmenuEntry(g.performer, g.qualifier, ctx.router),
    ),
  };
}

// Submenu entry — name plus a role/instrument qualifier in parens. Rendered
// under the parent "Go to performer" item so the verb is already implied.
function performerSubmenuEntry(
  performer: ClassicalPerformer,
  qualifier: string,
  router: Router,
): ContextMenuItem {
  return {
    label: qualifier
      ? "classical_performer_with_qualifier"
      : "classical_role_label_performer",
    labelArgs: qualifier ? [performer.name, qualifier] : [performer.name],
    icon: "mdi-account-music",
    action: () => router.push(`/classical/performers/${performer.item_id}`),
  };
}

// Show-info entry — navigates to the standard track detail view. Mirrors
// the action the upstream builder attaches when itemIsAvailable passes.
function showInfoEntry(track: Track, router: Router): ContextMenuItem {
  const albumUri = "media_type" in track.album ? track.album.uri : undefined;
  return {
    label: "show_info",
    labelArgs: [],
    icon: "mdi-information-outline",
    action: () =>
      router.push({
        name: "track",
        params: { itemId: track.item_id, provider: track.provider },
        query: albumUri ? { album: albumUri } : {},
      }),
  };
}

// Add-to-favourites entry. Injected explicitly because the standard
// getContextMenuItems gates this behind itemIsAvailable, which can return
// false for synthetic tracks when api.providers["library"] isn't reported
// as available.
function favouriteAddEntry(): ContextMenuItem {
  return {
    label: "favorites_add",
    labelArgs: [],
    icon: "mdi-heart-outline",
    // TODO: wire to api.addItemToFavorites(item) once tracks are real.
  };
}

const QUEUE_OPTION_ICON: Record<QueueOption, string> = {
  [QueueOption.PLAY]: "mdi-play-circle-outline",
  [QueueOption.NEXT]: "mdi-skip-next-circle-outline",
  [QueueOption.ADD]: "mdi-playlist-plus",
  [QueueOption.REPLACE]: "mdi-play-circle-outline",
  [QueueOption.REPLACE_NEXT]: "mdi-skip-next-circle-outline",
};

// Mirror of the upstream getPlaybackContextMenuItems output minus the
// availability gate. Used when the standard builder returns nothing for our
// synthetic tracks so the play + enqueue submenu still render.
function fallbackPlayItems(tracks: Track[]): ContextMenuItem[] {
  const uris = tracks.map((t) => t.uri);
  const playNow: ContextMenuItem = {
    label: "play_now",
    labelArgs: [],
    icon: "mdi-play-circle-outline",
    action: () => api.playMedia(uris, QueueOption.PLAY),
  };
  const enqueueSubItems: ContextMenuItem[] = (
    [
      QueueOption.PLAY,
      QueueOption.NEXT,
      QueueOption.ADD,
      QueueOption.REPLACE,
      QueueOption.REPLACE_NEXT,
    ] as QueueOption[]
  ).map((option) => ({
    label: i18n.global.t(`queue_option.${option}`),
    labelArgs: [],
    icon: QUEUE_OPTION_ICON[option],
    action: () => api.playMedia(uris, option),
  }));
  const enqueue: ContextMenuItem = {
    label: "enqueue",
    labelArgs: [],
    icon: "mdi-playlist-music",
    subItems: enqueueSubItems,
  };
  return [playNow, enqueue];
}

interface AggregatedCredit {
  performer: ClassicalPerformer;
  // role(s) + instrument(s) collected from all credits referencing this artist
  qualifier: string;
}

// Aggregate credits by Artist. A single artist with multiple credits on the
// same recording (e.g. conductor + harpsichord) collapses to one entry with
// role/instrument qualifiers combined in parens. Sorted by role priority.
function aggregateCredits(
  recording: ClassicalRecording,
  ctx: ClassicalMenuContext,
): AggregatedCredit[] {
  const credits = recordingCredits(recording);
  const map = new Map<
    string,
    { performer: ClassicalPerformer; entries: ClassicalCreditRecord[] }
  >();
  for (const credit of credits) {
    if (!NON_COMPOSER_ROLES.has(credit.role)) continue;
    const performer = ctx.performerLookup[credit.artist_id];
    if (!performer) continue;
    const existing = map.get(credit.artist_id);
    if (existing) existing.entries.push(credit);
    else map.set(credit.artist_id, { performer, entries: [credit] });
  }

  const aggregates: AggregatedCredit[] = [];
  for (const { performer, entries } of map.values()) {
    entries.sort((a, b) => rolePriority(a.role) - rolePriority(b.role));
    const parts = entries.map((e) =>
      e.instrument ? e.instrument : (ROLE_LABEL[e.role] ?? e.role),
    );
    aggregates.push({ performer, qualifier: dedupe(parts).join(", ") });
  }
  aggregates.sort(
    (a, b) => rolePriority(a.performer.role) - rolePriority(b.performer.role),
  );
  return aggregates;
}

// Surface credits from the explicit credits[] field when present, otherwise
// derive from the legacy flat fields so older fixtures still work.
function recordingCredits(
  recording: ClassicalRecording,
): ClassicalCreditRecord[] {
  if (recording.credits?.length) return recording.credits;
  const derived: ClassicalCreditRecord[] = [];
  let pos = 0;
  if (recording.conductor_id)
    derived.push({
      artist_id: recording.conductor_id,
      role: ArtistRole.CONDUCTOR,
      position: pos++,
    });
  if (recording.orchestra_id)
    derived.push({
      artist_id: recording.orchestra_id,
      role: ArtistRole.ORCHESTRA,
      position: pos++,
    });
  for (const pid of recording.performer_ids ?? [])
    derived.push({
      artist_id: pid,
      role: ArtistRole.PERFORMER,
      position: pos++,
    });
  return derived;
}

function creditedPerformers(
  recording: ClassicalRecording,
  ctx: ClassicalMenuContext,
): ClassicalPerformer[] {
  const ids = new Set(recordingCredits(recording).map((c) => c.artist_id));
  return Array.from(ids)
    .map((id) => ctx.performerLookup[id])
    .filter((p): p is ClassicalPerformer => !!p);
}

function rolePriority(role: ArtistRole | string): number {
  const idx = ROLE_PRIORITY.indexOf(role as ArtistRole);
  return idx === -1 ? 99 : idx;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function movementIndex(
  movement: ClassicalRecordingMovement,
  recording: ClassicalRecording,
): number {
  return recording.movements.findIndex((m) => m.track_id === movement.track_id);
}
