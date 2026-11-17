import type { ArtistRowId } from "@/components/artist/artistRows";
import {
  discographyTypes,
  discographyTypesLabel,
  isDiscographyRow,
  type DiscographyRowId,
} from "@/components/artist/discographyRows";
import type { Album } from "@/plugins/api/interfaces";
import { computed, type Ref } from "vue";

/**
 * How the artist page lays out its discography rows.
 *
 * Discography rows next to each other read as one section: the heading sits
 * above the first only, and the gap between them is tighter than between other
 * rows.
 */
export function useDiscographyRows(
  visibleRows: Ref<ArtistRowId[]>,
  items: Record<DiscographyRowId, Ref<Album[] | undefined>>,
  counts?: Record<DiscographyRowId, Ref<number | undefined>>,
) {
  const rowItems = computed<Record<DiscographyRowId, Album[] | undefined>>(
    () => ({
      discography: items.discography.value,
      discography_second: items.discography_second.value,
    }),
  );

  // the discography rows right below another discography row
  const continuingRows = computed(
    () =>
      new Set(
        visibleRows.value.filter(
          (rowId, index) =>
            isDiscographyRow(rowId) &&
            index > 0 &&
            isDiscographyRow(visibleRows.value[index - 1]),
        ),
      ),
  );

  /** Whether the row heads its section, with the discography heading. */
  function showsHeading(rowId: DiscographyRowId): boolean {
    return !continuingRows.value.has(rowId);
  }

  /** Whether another discography row continues right below this one. */
  function continuesBelow(rowId: DiscographyRowId): boolean {
    const next = visibleRows.value[visibleRows.value.indexOf(rowId) + 1];
    return next !== undefined && continuingRows.value.has(next);
  }

  /** The row's release types for the rows editor, with its count once loaded. */
  function meta(rowId: DiscographyRowId): string {
    const summary = discographyTypesLabel(discographyTypes(rowId));
    const count = counts ? counts[rowId].value : rowItems.value[rowId]?.length;
    return count ? `${summary} · ${count}` : summary;
  }

  return { rowItems, showsHeading, continuesBelow, meta };
}
