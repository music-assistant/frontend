import type { MediaType } from "@/plugins/api/interfaces";

// null/undefined content_type both mean the music/general taxonomy.
export function normalizeGenreTaxonomy(
  contentType?: MediaType | null,
): MediaType | null {
  return contentType ?? null;
}

export function genresShareTaxonomy(
  contentTypes: Array<MediaType | null | undefined>,
): boolean {
  if (contentTypes.length === 0) return true;
  const first = normalizeGenreTaxonomy(contentTypes[0]);
  return contentTypes.every((ct) => normalizeGenreTaxonomy(ct) === first);
}
