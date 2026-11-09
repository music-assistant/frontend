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
 * rows. A row that comes up empty is left out, so the row after it takes its
 * place.
 */
export function useDiscographyRows(
  visibleRows: Ref<ArtistRowId[]>,
  items: Record<DiscographyRowId, Ref<Album[] | undefined>>,
) {
  const rowItems = computed<Record<DiscographyRowId, Album[] | undefined>>(
    () => ({
      discography: items.discography.value,
      discography_second: items.discography_second.value,
    }),
  );

  // the visible rows, less the discography rows that came up empty
  const shownRows = computed(() =>
    visibleRows.value.filter(
      (rowId) => !isDiscographyRow(rowId) || isShown(rowId),
    ),
  );

  // the discography rows right below another discography row
  const continuingRows = computed(
    () =>
      new Set(
        shownRows.value.filter(
          (rowId, index) =>
            isDiscographyRow(rowId) &&
            index > 0 &&
            isDiscographyRow(shownRows.value[index - 1]),
        ),
      ),
  );

  /** A row is rendered while it loads and once it has something to show. */
  function isShown(rowId: DiscographyRowId): boolean {
    const rowList = rowItems.value[rowId];
    return rowList === undefined || rowList.length > 0;
  }

  /** Whether the row heads its section, with the discography heading. */
  function showsHeading(rowId: DiscographyRowId): boolean {
    return !continuingRows.value.has(rowId);
  }

  /** Whether another discography row continues right below this one. */
  function continuesBelow(rowId: DiscographyRowId): boolean {
    const next = shownRows.value[shownRows.value.indexOf(rowId) + 1];
    return next !== undefined && continuingRows.value.has(next);
  }

  /** The row's release types for the rows editor, with its count once loaded. */
  function meta(rowId: DiscographyRowId): string {
    const summary = discographyTypesLabel(discographyTypes(rowId));
    const count = rowItems.value[rowId]?.length;
    return count ? `${summary} · ${count}` : summary;
  }

  return { rowItems, isShown, showsHeading, continuesBelow, meta };
}
