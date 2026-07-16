import type { MediaType } from "@/plugins/api/interfaces";

// null/undefined content_type both mean the music/general taxonomy.
export function genresShareTaxonomy(
  contentTypes: Array<MediaType | null | undefined>,
): boolean {
  const taxonomies = new Set(contentTypes.map((ct) => ct ?? null));
  return taxonomies.size <= 1;
}
