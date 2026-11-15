import {
  createRowRegistry,
  type RowDefinition,
} from "@/components/details/rowRegistry";
import type { Audiobook } from "@/plugins/api/interfaces";

export type AudiobookRowId = "about" | "chapters" | "provider_mappings";

export const AUDIOBOOK_ROWS: readonly RowDefinition<AudiobookRowId>[] = [
  { id: "about", labelKey: "description" },
  { id: "chapters", labelKey: "chapters" },
  { id: "provider_mappings", labelKey: "source_details" },
];

export const AUDIOBOOK_ROWS_PREFERENCE_KEY = "audiobook.rows";

/** The audiobook page's rows and the user's customization of them. */
export const audiobookRows = createRowRegistry<AudiobookRowId, Audiobook>({
  rows: AUDIOBOOK_ROWS,
  preferenceKey: AUDIOBOOK_ROWS_PREFERENCE_KEY,
});
