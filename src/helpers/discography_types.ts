import { AlbumType } from "@/plugins/api/interfaces";

/** The release types a discography row or listing can be narrowed to, in the order they are offered. */
export const DISCOGRAPHY_TYPES: readonly AlbumType[] = [
  AlbumType.ALBUM,
  AlbumType.SINGLE,
  AlbumType.EP,
  AlbumType.COMPILATION,
  AlbumType.LIVE,
  AlbumType.SOUNDTRACK,
];

/**
 * The discography types among `values`, once each and in offered order; [] when
 * `values` is not a list or holds none of them.
 */
export function validDiscographyTypes(values: unknown): AlbumType[] {
  if (!Array.isArray(values)) return [];
  return DISCOGRAPHY_TYPES.filter((type) => values.includes(type));
}

/**
 * The selection with `type` ticked or unticked. The last ticked type stays
 * ticked, so a selection never ends up empty.
 */
export function withDiscographyTypeToggled(
  types: readonly AlbumType[],
  type: AlbumType,
): AlbumType[] {
  if (!types.includes(type)) return validDiscographyTypes([...types, type]);
  const remaining = types.filter((ticked) => ticked !== type);
  return remaining.length ? remaining : [...types];
}

/**
 * A short summary of a selection: the first type's label, plus the number of
 * the others, e.g. "Albums +2".
 */
export function discographyTypesSummary(
  types: readonly AlbumType[],
  label: (type: AlbumType) => string,
): string {
  const [first, ...others] = types;
  if (!first) return "";
  return others.length ? `${label(first)} +${others.length}` : label(first);
}
