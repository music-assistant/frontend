import { useLibrarySorting } from "@/composables/useLibrarySorting";
import {
  SortDirection,
  SortField,
  type SortOptionInfo,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { computed, ref } from "vue";

const options: SortOptionInfo[] = [
  {
    field: SortField.NAME,
    supports_direction: true,
    default_direction: SortDirection.ASC,
    label_key: "name",
  },
  {
    field: SortField.TIMESTAMP_ADDED,
    supports_direction: true,
    default_direction: SortDirection.DESC,
    label_key: "timestamp_added",
  },
  {
    field: SortField.PLAY_COUNT,
    supports_direction: true,
    default_direction: SortDirection.DESC,
    label_key: "play_count",
  },
  {
    field: SortField.ARTIST_NAME,
    supports_direction: true,
    default_direction: SortDirection.ASC,
    label_key: "artist_name",
  },
  {
    field: SortField.RANDOM,
    supports_direction: false,
    default_direction: null,
    label_key: "random",
  },
  {
    field: SortField.RANDOM_PLAY_COUNT,
    supports_direction: false,
    default_direction: null,
    label_key: "random_play_count",
  },
];

describe("useLibrarySorting", () => {
  it("preserves ascending semantics for unsuffixed legacy values", () => {
    const sortBy = ref("timestamp_added");
    const sorting = useLibrarySorting(options, sortBy);

    expect(sorting.normalizeSortBy(sortBy.value)).toBe("timestamp_added:asc");
    expect(sorting.current.value.direction).toBe(SortDirection.ASC);
  });

  it("preserves explicit descending values and migrates legacy artist aliases", () => {
    const sorting = useLibrarySorting(options, ref("name_desc"));

    expect(sorting.normalizeSortBy("name_desc")).toBe("name:desc");
    expect(sorting.normalizeSortBy("track_artist_name_desc")).toBe(
      "artist_name:desc",
    );
    expect(sorting.normalizeSortBy("album_artist_name")).toBe(
      "artist_name:asc",
    );
  });

  it("keeps random sorts directionless and falls back for unsupported fields", () => {
    const sorting = useLibrarySorting(options, ref("random"));

    expect(sorting.normalizeSortBy("random")).toBe("random");
    expect(sorting.normalizeSortBy("random_play_count")).toBe(
      "random_play_count",
    );
    expect(sorting.normalizeSortBy("not_a_sort_field")).toBe("name:asc");
  });

  it("derives quick options only from fields the server returned", () => {
    const sorting = useLibrarySorting(
      options.filter((option) => option.field !== SortField.TIMESTAMP_ADDED),
      ref("name:asc"),
    );

    expect(sorting.quickOptions.value.map((option) => option.field)).toEqual([
      SortField.PLAY_COUNT,
      SortField.NAME,
    ]);
  });

  it("uses defaults for a new field and toggles the selected quick field", () => {
    const sortBy = ref("name:asc");
    const sorting = useLibrarySorting(options, sortBy);

    expect(sorting.sortByOption(options[1])).toBe("timestamp_added:desc");
    expect(sorting.sortByQuickOption(options[1])).toBe("timestamp_added:desc");

    sortBy.value = "play_count:desc";
    expect(sorting.sortByQuickOption(options[2])).toBe("play_count:asc");
    expect(sorting.sortByDirection(SortDirection.ASC)).toBe("play_count:asc");
  });

  it("keeps current direction reactive to the listing sort value", () => {
    const sortBy = ref("name:asc");
    const sorting = useLibrarySorting(
      options,
      computed(() => sortBy.value),
    );

    sortBy.value = "play_count:desc";

    expect(sorting.current.value).toEqual({
      field: SortField.PLAY_COUNT,
      direction: SortDirection.DESC,
    });
  });
});
