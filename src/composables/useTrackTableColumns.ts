import {
  OPTIONAL_TRACK_COLUMNS,
  visibleTrackColumns,
  type OptionalTrackColumn,
} from "@/components/track-table/trackTableColumns";
import { useUserPreferences } from "@/composables/userPreferences";
import {
  useElementSize,
  useMediaQuery,
  type MaybeComputedElementRef,
} from "@vueuse/core";
import { computed } from "vue";

const COLUMNS_PREF_KEY = "track_table.columns";

/**
 * The track table's columns: the ones the user switched on, remembered per
 * user, and the ones shown at the current width of the table element and on
 * this kind of device.
 */
export function useTrackTableColumns(table: MaybeComputedElementRef) {
  const { getPreference, setPreference } = useUserPreferences();
  const { width } = useElementSize(table);
  const isTouch = useMediaQuery("(hover: none)");

  const enabledColumns = getPreference<OptionalTrackColumn[]>(
    COLUMNS_PREF_KEY,
    OPTIONAL_TRACK_COLUMNS,
  );

  const visibleColumns = computed(() =>
    visibleTrackColumns(enabledColumns.value, width.value, isTouch.value),
  );

  const setEnabledColumns = function (columns: OptionalTrackColumn[]) {
    setPreference(COLUMNS_PREF_KEY, columns);
  };

  return { enabledColumns, visibleColumns, setEnabledColumns };
}
