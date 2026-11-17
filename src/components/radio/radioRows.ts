import {
  createRowRegistry,
  type RowDefinition,
} from "@/components/details/rowRegistry";
import type { Radio } from "@/plugins/api/interfaces";

export type RadioRowId =
  | "description"
  | "dynamic_sample"
  | "tracklist"
  | "other_versions"
  | "provider_mappings";

export const RADIO_ROWS: readonly RowDefinition<RadioRowId>[] = [
  { id: "description", labelKey: "description" },
  { id: "dynamic_sample", labelKey: "dynamic_radio_heading" },
  { id: "tracklist", labelKey: "tracklist_heading" },
  { id: "other_versions", labelKey: "other_versions" },
  { id: "provider_mappings", labelKey: "source_details" },
];

export const RADIO_ROWS_PREFERENCE_KEY = "radio.rows";

/** Rows the radio page can show for this station. */
export function availableRadioRowIds(radio: Radio): RadioRowId[] {
  const contentRow: RadioRowId = radio.is_dynamic
    ? "dynamic_sample"
    : radio.is_endless === false
      ? "tracklist"
      : "other_versions";

  return ["description", contentRow, "provider_mappings"];
}

/** The radio page's rows and the user's customization of them. */
export const radioRows = createRowRegistry<RadioRowId, Radio>({
  rows: RADIO_ROWS,
  preferenceKey: RADIO_ROWS_PREFERENCE_KEY,
});
