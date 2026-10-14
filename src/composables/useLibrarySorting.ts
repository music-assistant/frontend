import {
  SortDirection,
  SortField,
  type SortOptionInfo,
} from "@/plugins/api/interfaces";
import { computed, toValue, type MaybeRefOrGetter } from "vue";

const QUICK_SORT_FIELDS = [
  SortField.TIMESTAMP_ADDED,
  SortField.PLAY_COUNT,
  SortField.SORT_NAME,
];

function parseSortBy(sortBy: string) {
  const match = sortBy.match(/^(.+?)(?::|_)(asc|desc)$/);
  const rawField = match?.[1] ?? sortBy;
  const legacyFieldAliases: Record<string, SortField> = {
    album_artist_name: SortField.ARTIST_NAME,
    track_artist_name: SortField.ARTIST_NAME,
  };
  const field = legacyFieldAliases[rawField] ?? rawField;

  return {
    field,
    direction:
      match?.[2] === SortDirection.ASC || match?.[2] === SortDirection.DESC
        ? (match[2] as SortDirection)
        : SortDirection.ASC,
  };
}

function makeSortValue(
  option: SortOptionInfo,
  direction = option.default_direction ?? SortDirection.ASC,
) {
  return option.supports_direction
    ? `${option.field}:${direction}`
    : option.field;
}

export function useLibrarySorting(
  optionsSource: MaybeRefOrGetter<SortOptionInfo[]>,
  sortBySource: MaybeRefOrGetter<string>,
) {
  const options = computed(() => toValue(optionsSource));
  const sortBy = computed(() => toValue(sortBySource));

  const current = computed(() => parseSortBy(sortBy.value));

  const selectedOption = computed(() =>
    options.value.find((option) => option.field === current.value.field),
  );

  const quickOptions = computed(() =>
    QUICK_SORT_FIELDS.flatMap((field) => {
      const option = options.value.find((item) => item.field === field);
      return option ? [option] : [];
    }),
  );

  const normalizeSortBy = (value: string): string => {
    if (!options.value.length) return value;
    const parsed = parseSortBy(value);
    const option = options.value.find((item) => item.field === parsed.field);
    if (!option) return makeSortValue(options.value[0]);
    return makeSortValue(option, parsed.direction);
  };

  const sortByOption = (option: SortOptionInfo) => makeSortValue(option);

  const sortByDirection = (direction: SortDirection) => {
    const option = selectedOption.value;
    return option?.supports_direction
      ? makeSortValue(option, direction)
      : undefined;
  };

  const sortByQuickOption = (option: SortOptionInfo) => {
    if (current.value.field === option.field && option.supports_direction) {
      return makeSortValue(
        option,
        current.value.direction === SortDirection.DESC
          ? SortDirection.ASC
          : SortDirection.DESC,
      );
    }
    return sortByOption(option);
  };

  return {
    current,
    selectedOption,
    quickOptions,
    normalizeSortBy,
    sortByOption,
    sortByDirection,
    sortByQuickOption,
  };
}
