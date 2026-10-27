import { computed, type Ref } from "vue";
import { useI18n } from "vue-i18n";

import type { LoadDataParams } from "@/composables/useItemsListing";
import type {
  ListingFilter,
  ListingFilterOption,
} from "@/helpers/listing_filters";
import { EyeOff, Files, Heart, LibraryBig, MicVocal } from "@lucide/vue";

/** The album types a listing can be narrowed to, in the order they are offered. */
export const ALBUM_TYPE_FILTER_KEYS = [
  "album",
  "single",
  "ep",
  "compilation",
  "live",
  "soundtrack",
  "unknown",
];

// the genres listing's hide-empty filter has three states; these name them
const GENRES_SHOWN = {
  all: "all",
  hideEmpty: "hide_empty",
  defaultsOnly: "defaults_only",
} as const;

const genresShown = (hideEmpty: boolean | null | undefined) => {
  if (hideEmpty === true) return GENRES_SHOWN.hideEmpty;
  if (hideEmpty === null) return GENRES_SHOWN.defaultsOnly;
  return GENRES_SHOWN.all;
};

const hideEmptyFor = (shown: string) => {
  if (shown === GENRES_SHOWN.hideEmpty) return true;
  if (shown === GENRES_SHOWN.defaultsOnly) return null;
  return false;
};

/** Which filters the listing offers. */
interface ListingFilterFlags {
  showFavoritesOnlyFilter?: boolean;
  showAlbumArtistsOnlyFilter?: boolean;
  showLibraryOnlyFilter?: boolean;
  showHideFullyPlayedFilter?: boolean;
  showCollapseCollections?: boolean;
  showHideEmptyFilter?: boolean;
  showGenreFilter?: boolean;
  showAlbumTypeFilter?: boolean;
}

interface ListingFilterState {
  params: Ref<LoadDataParams>;
  genreOptions: Ref<{ label: string; value: number }[]>;
  // empty when the listing offers no source filter
  providerOptions: Ref<ListingFilterOption[]>;
}

/** What changing each filter does: the listing saves and reloads. */
export interface ListingFilterActions {
  toggleFavorites: () => void;
  toggleAlbumArtists: () => void;
  toggleLibraryOnly: () => void;
  toggleHideFullyPlayed: () => void;
  toggleCollapseCollections: () => void;
  setHideEmpty: (hideEmpty: boolean | null) => void;
  toggleGenre: (genreId: number) => void;
  toggleAlbumType: (albumType: string) => void;
  toggleProvider: (providerId: string) => void;
}

const genreIdsOf = (genreIds: LoadDataParams["genreIds"]) => {
  if (Array.isArray(genreIds)) return genreIds;
  return typeof genreIds === "number" ? [genreIds] : [];
};

/**
 * The filters a library listing offers, each with its current state, for the
 * Filters panel and the active filter chips.
 */
export function useListingFilters(
  flags: Readonly<ListingFilterFlags>,
  state: ListingFilterState,
  actions: ListingFilterActions,
) {
  const { t } = useI18n();

  return computed<ListingFilter[]>(() => {
    const params = state.params.value;
    const filters: ListingFilter[] = [];

    if (flags.showFavoritesOnlyFilter) {
      filters.push({
        kind: "toggle",
        id: "favorites",
        label: t("listing_filters.favorites_only"),
        icon: Heart,
        active: !!params.favoritesOnly,
        toggle: actions.toggleFavorites,
      });
    }
    if (flags.showAlbumArtistsOnlyFilter) {
      filters.push({
        kind: "toggle",
        id: "album_artists",
        label: t("listing_filters.album_artists_only"),
        icon: MicVocal,
        active: !!params.albumArtistsFilter,
        toggle: actions.toggleAlbumArtists,
      });
    }
    if (flags.showLibraryOnlyFilter) {
      filters.push({
        kind: "toggle",
        id: "library_only",
        label: t("listing_filters.library_only"),
        icon: LibraryBig,
        active: !!params.libraryOnly,
        toggle: actions.toggleLibraryOnly,
      });
    }
    if (flags.showHideFullyPlayedFilter) {
      filters.push({
        kind: "toggle",
        id: "hide_fully_played",
        label: t("listing_filters.hide_fully_played"),
        icon: EyeOff,
        active: !!params.hideFullyPlayed,
        toggle: actions.toggleHideFullyPlayed,
      });
    }
    if (flags.showCollapseCollections) {
      filters.push({
        kind: "toggle",
        id: "collapse_collections",
        label: t("listing_filters.collapse_collections"),
        icon: Files,
        active: !!params.collapseCollections,
        toggle: actions.toggleCollapseCollections,
      });
    }
    if (flags.showHideEmptyFilter) {
      filters.push({
        kind: "choice",
        id: "genres_shown",
        label: t("listing_filters.genres_shown"),
        options: [
          { label: t("tooltip.show_all_genres"), value: GENRES_SHOWN.all },
          {
            label: t("tooltip.hide_empty_genres"),
            value: GENRES_SHOWN.hideEmpty,
          },
          {
            label: t("tooltip.show_only_default_genres"),
            value: GENRES_SHOWN.defaultsOnly,
          },
        ],
        selected: genresShown(params.hideEmptyFilter),
        // hiding empty genres is where the listing starts, so only a change
        // from it shows as a filter
        unfiltered: GENRES_SHOWN.hideEmpty,
        select: (value) => actions.setHideEmpty(hideEmptyFor(value)),
      });
    }
    if (flags.showGenreFilter && state.genreOptions.value.length) {
      filters.push({
        kind: "multi",
        id: "genre",
        label: t("listing_filters.genre"),
        placeholder: t("listing_filters.any_genre"),
        layout: "dropdown",
        options: state.genreOptions.value.map((genre) => ({
          label: genre.label,
          value: String(genre.value),
        })),
        selected: genreIdsOf(params.genreIds).map(String),
        toggle: (value) => actions.toggleGenre(Number(value)),
      });
    }
    if (flags.showAlbumTypeFilter) {
      filters.push({
        kind: "multi",
        id: "album_type",
        label: t("listing_filters.album_type"),
        placeholder: t("listing_filters.any_album_type"),
        layout: "dropdown",
        options: ALBUM_TYPE_FILTER_KEYS.map((key) => ({
          label: t(`album_type.${key}`),
          value: key,
        })),
        selected: params.albumType ?? [],
        toggle: actions.toggleAlbumType,
      });
    }
    if (state.providerOptions.value.length) {
      filters.push({
        kind: "multi",
        id: "provider",
        label: t("listing_filters.source"),
        placeholder: t("listing_filters.any_source"),
        layout: "checkboxes",
        options: state.providerOptions.value,
        selected: params.provider ?? [],
        toggle: actions.toggleProvider,
      });
    }
    return filters;
  });
}
