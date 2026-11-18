import { ROTATION_PROVIDER_DOMAIN } from "@/components/rotation/constants";
import type {
  Playlist,
  RotationDescribe,
  RotationStep,
} from "@/plugins/api/interfaces";

export type ItemKind = "artist" | "album" | "track";

export interface ListState {
  kind: ItemKind;
  depth: number;
}

/** The kind and group depth of the list after each step (same rules as the server). */
export function listStates(steps: RotationStep[]): ListState[] {
  const result: ListState[] = [];
  let kind: ItemKind = "album";
  let depth = 0;
  for (const step of steps) {
    if (step.type === "source") {
      kind = step.media_type;
      depth = 0;
    } else if (step.type === "expand") {
      kind = step.to;
      depth += 1;
    } else if (step.type === "flatten") {
      depth = 0;
    }
    result.push({ kind, depth });
  }
  return result;
}

/**
 * The kind of the units a round counts: the items of the outermost list.
 * @param steps The steps of the Rotation.
 */
export function unitKind(steps: RotationStep[]): ItemKind {
  let kind: ItemKind = "album";
  for (const state of listStates(steps)) {
    if (state.depth === 0) kind = state.kind;
  }
  return kind;
}

/**
 * The Rotation id of a playlist, as the editor route expects it.
 * @param playlist The playlist; undefined while it loads.
 * @returns The id, or undefined when the playlist is no Rotation.
 */
export function rotationIdOf(
  playlist: Playlist | undefined,
): string | undefined {
  return playlist?.provider_mappings?.find(
    (mapping) => mapping.provider_domain === ROTATION_PROVIDER_DOMAIN,
  )?.item_id;
}

export function addableStepTypes(
  steps: RotationStep[],
): RotationStep["type"][] {
  if (steps.length === 0) return ["source"];
  const state = listStates(steps)[steps.length - 1]!;
  const types: RotationStep["type"][] = ["filter", "sort", "limit"];
  if (state.kind !== "track") types.push("expand");
  if (state.depth > 0) types.push("flatten");
  return types;
}

/**
 * The kind of the innermost groups the list is in after the steps.
 * @param steps The steps to walk.
 * @returns The kind, or null when the list is not grouped.
 */
export function groupKind(steps: RotationStep[]): ItemKind | null {
  const parents: ItemKind[] = [];
  let kind: ItemKind = "album";
  for (const step of steps) {
    if (step.type === "source") {
      kind = step.media_type;
      parents.length = 0;
    } else if (step.type === "expand") {
      parents.push(kind);
      kind = step.to;
    } else if (step.type === "flatten") {
      parents.length = 0;
    }
  }
  return parents.at(-1) ?? null;
}

/**
 * Create a step with defaults.
 * @param type The step type to create.
 * @param state The state of the list the step will work on.
 * @param describe The field catalogue, for field dependent defaults.
 * @param group The kind of the groups the step works inside, if any.
 */
export function newStep(
  type: RotationStep["type"],
  state: ListState,
  describe: RotationDescribe,
  group: ItemKind | null = null,
): RotationStep {
  switch (type) {
    case "source":
      return { type: "source", media_type: "album", from: "library" };
    case "filter":
      return { type: "filter", mode: "keep", match: "all", conditions: [] };
    case "sort":
      return { type: "sort", keys: defaultSortKeys(state, describe, group) };
    case "limit":
      return { type: "limit", count: 10 };
    case "expand":
      return {
        type: "expand",
        to: state.kind === "artist" ? "album" : "track",
        scope: "library",
      };
    case "flatten":
      return { type: "flatten" };
  }
}

/** Move a step without touching the source step at index 0. */
export function moveStep(
  steps: RotationStep[],
  from: number,
  to: number,
): RotationStep[] {
  const last = steps.length - 1;
  if (from < 1 || to < 1 || from > last || to > last || from === to) {
    return [...steps];
  }
  const result = [...steps];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved!);
  return result;
}

/**
 * i18n key of the indent header shown after an expand.
 * @param state The state of the list that is expanded, so the kind of the groups.
 */
export function groupLabelKey(state: ListState): string {
  return state.kind === "artist"
    ? "rotation.inside_each_artist"
    : "rotation.inside_each_album";
}

/** True when the step at index works inside groups. */
export function isGrouped(index: number, steps: RotationStep[]): boolean {
  if (index < 1) return false;
  return (listStates(steps)[index - 1]?.depth ?? 0) > 0;
}

export function refLabelFallback(uri: string): string {
  const parts = uri.split("/").filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? uri;
}

// the tracks of an album play in album order unless the user picks another
const ALBUM_ORDER = ["disc_number", "track_number"];

function defaultSortKeys(
  state: ListState,
  describe: RotationDescribe,
  group: ItemKind | null,
): { field: string }[] {
  const keys = describe.media_types.track?.sort_keys ?? [];
  if (
    state.kind === "track" &&
    group === "album" &&
    ALBUM_ORDER.every((field) => keys.includes(field))
  ) {
    return ALBUM_ORDER.map((field) => ({ field }));
  }
  return [{ field: "random" }];
}
