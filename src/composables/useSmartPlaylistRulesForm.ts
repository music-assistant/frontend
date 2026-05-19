import { nextTick, reactive, ref, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";
import api from "@/plugins/api";
import type {
  SmartPlaylistRules,
  Track,
  Artist,
} from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import { useSmartPlaylistSeedItems } from "./useSmartPlaylistSeedItems";
import { useSmartPlaylistGenres } from "./useSmartPlaylistGenres";
import { useSmartPlaylistContentFilters } from "./useSmartPlaylistContentFilters";
import { useSmartPlaylistYearRange } from "./useSmartPlaylistYearRange";

export interface SmartPlaylistRulesFormInit {
  initialRules?: SmartPlaylistRules | null;
  initialArtistItems?: { id: number; name: string }[];
  initialAlbumItems?: { id: number; name: string }[];
}

export type TrackCountUpdateHandler = (
  count: number | null,
  duration: number | null,
  counting: boolean,
) => void;

export function useSmartPlaylistRulesForm(
  props: SmartPlaylistRulesFormInit,
  onTrackCountUpdate: TrackCountUpdateHandler,
) {
  // Core rules object
  const rules = reactive<SmartPlaylistRules>({
    genre_ids: [],
    artist_ids: [],
    album_ids: [],
    favorites_only: false,
    seed_track_uri: undefined,
    seed_track_name: undefined,
    seed_artist_uri: undefined,
    seed_artist_name: undefined,
    seed_artist_library_only: false,
    excluded_artist_ids: [],
    excluded_album_ids: [],
    excluded_genre_ids: [],
    excluded_track_uris: [],
    excluded_artist_names: {},
    excluded_album_names: {},
    excluded_genre_names: {},
    min_popularity: undefined,
    dedup_hours: undefined,
    logic: "AND",
    limit: 100,
    year_from: undefined,
    year_to: undefined,
  });

  // Initialize sub-composables
  const seedItems = useSmartPlaylistSeedItems();
  const genresComposable = useSmartPlaylistGenres();
  const contentFilters = useSmartPlaylistContentFilters();
  const yearRange = useSmartPlaylistYearRange();

  const trackCountRequestId = ref(0);

  // Track count update with request-id guard
  const _updateTrackCount = useDebounceFn(async () => {
    const requestId = ++trackCountRequestId.value;

    if (seedItems.seedTrackUri.value || seedItems.seedArtistUri.value) {
      if (requestId === trackCountRequestId.value) {
        onTrackCountUpdate(null, null, false);
      }
      return;
    }

    if (requestId === trackCountRequestId.value) {
      onTrackCountUpdate(null, null, true);
    }

    try {
      const finalRules: SmartPlaylistRules = {
        ...rules,
        seed_track_uri: undefined,
        seed_artist_uri: undefined,
      };
      const stats = await api.countSmartPlaylistTracks(finalRules);
      if (requestId === trackCountRequestId.value) {
        onTrackCountUpdate(stats.count, stats.duration_seconds, false);
      }
    } catch {
      if (requestId === trackCountRequestId.value) {
        onTrackCountUpdate(null, null, false);
      }
    }
  }, 600);

  // Watch rules and seed changes for track count updates
  watch(rules, () => {
    _updateTrackCount();
  });

  watch(seedItems.seedTrackUri, () => {
    _updateTrackCount();
  });

  watch(seedItems.seedArtistUri, () => {
    _updateTrackCount();
  });

  // Initialize from props
  watch(
    () => props.initialRules,
    async (initial) => {
      if (!initial) return;

      // Sync rules
      rules.genre_ids = [...initial.genre_ids];
      rules.artist_ids = [...initial.artist_ids];
      rules.album_ids = [...initial.album_ids];
      rules.favorites_only = initial.favorites_only;
      rules.seed_track_uri = initial.seed_track_uri;
      rules.seed_track_name = initial.seed_track_name;
      rules.min_popularity = initial.min_popularity ?? undefined;
      rules.logic = initial.logic;
      rules.limit = initial.limit;
      rules.year_from = initial.year_from ?? undefined;
      rules.year_to = initial.year_to ?? undefined;
      rules.excluded_artist_ids = initial.excluded_artist_ids
        ? [...initial.excluded_artist_ids]
        : [];
      rules.excluded_album_ids = initial.excluded_album_ids
        ? [...initial.excluded_album_ids]
        : [];
      rules.excluded_genre_ids = initial.excluded_genre_ids
        ? [...initial.excluded_genre_ids]
        : [];
      rules.excluded_track_uris = initial.excluded_track_uris
        ? [...initial.excluded_track_uris]
        : [];
      rules.dedup_hours = initial.dedup_hours ?? undefined;
      rules.seed_artist_uri = initial.seed_artist_uri;
      rules.seed_artist_name = initial.seed_artist_name;
      rules.seed_artist_library_only =
        initial.seed_artist_library_only ?? false;
      rules.genre_names = initial.genre_names
        ? { ...initial.genre_names }
        : undefined;
      rules.artist_names = initial.artist_names
        ? { ...initial.artist_names }
        : undefined;
      rules.album_names = initial.album_names
        ? { ...initial.album_names }
        : undefined;

      // Sync seed items
      seedItems.seedTrackUri.value = initial.seed_track_uri ?? "";
      seedItems.selectedSeedTrack.value = null;
      seedItems.seedArtistUri.value = initial.seed_artist_uri ?? "";
      seedItems.selectedSeedArtist.value = null;

      if (initial.seed_artist_uri) {
        try {
          const item = await api.getItemByUri(initial.seed_artist_uri);
          if (item.media_type === MediaType.ARTIST) {
            seedItems.selectedSeedArtist.value = item as Artist;
          }
        } catch {
          // not resolvable
        }
      }

      if (initial.seed_track_uri) {
        try {
          const item = await api.getItemByUri(initial.seed_track_uri);
          if (item.media_type === MediaType.TRACK) {
            seedItems.selectedSeedTrack.value = item as Track;
          }
        } catch {
          // URI not resolvable
        }
      }

      await nextTick();

      // Sync year inputs
      if (yearRange.yearFromEl.value) {
        yearRange.yearFromEl.value.value = initial.year_from
          ? String(initial.year_from)
          : "";
      }
      if (yearRange.yearToEl.value) {
        yearRange.yearToEl.value.value = initial.year_to
          ? String(initial.year_to)
          : "";
      }
    },
    { immediate: true },
  );

  watch(
    () => props.initialArtistItems,
    (items) => {
      contentFilters.selectedArtistItems.value = [...(items ?? [])];
    },
    { immediate: true },
  );

  watch(
    () => props.initialAlbumItems,
    (items) => {
      contentFilters.selectedAlbumItems.value = [...(items ?? [])];
    },
    { immediate: true },
  );

  function getFinalRules(): SmartPlaylistRules {
    // Update year values from inputs
    rules.year_from = yearRange.onYearFromInput();
    rules.year_to = yearRange.onYearToInput();

    // Build genre names map
    const genreNamesMap: Record<number, string> = {};
    for (const id of rules.genre_ids) {
      const found = genresComposable.genres.value.find(
        (g) => parseInt(g.item_id) === id,
      );
      if (found) genreNamesMap[id] = found.name;
    }

    // Build artist names map
    const artistNamesMap: Record<number, string> = {};
    for (const item of contentFilters.selectedArtistItems.value) {
      artistNamesMap[item.id] = item.name;
    }

    // Build album names map
    const albumNamesMap: Record<number, string> = {};
    for (const item of contentFilters.selectedAlbumItems.value) {
      albumNamesMap[item.id] = item.name;
    }

    return {
      ...rules,
      seed_track_uri: seedItems.seedTrackUri.value || undefined,
      seed_track_name: seedItems.selectedSeedTrack.value
        ? `${seedItems.selectedSeedTrack.value.name} – ${(seedItems.selectedSeedTrack.value.artists as Artist[])[0]?.name ?? ""}`
        : undefined,
      seed_artist_uri: seedItems.seedArtistUri.value || undefined,
      seed_artist_name: seedItems.selectedSeedArtist.value?.name,
      excluded_artist_ids: rules.excluded_artist_ids,
      excluded_album_ids: rules.excluded_album_ids,
      excluded_genre_ids: rules.excluded_genre_ids,
      excluded_track_uris: rules.excluded_track_uris,
      excluded_artist_names: Object.fromEntries(
        contentFilters.selectedExcludedArtistItems.value.map((a) => [
          a.id,
          a.name,
        ]),
      ),
      excluded_album_names: Object.fromEntries(
        contentFilters.selectedExcludedAlbumItems.value.map((a) => [
          a.id,
          a.name,
        ]),
      ),
      excluded_genre_names: Object.fromEntries(
        (rules.excluded_genre_ids ?? []).map((id) => [
          id,
          genresComposable.genres.value.find((g) => parseInt(g.item_id) === id)
            ?.name ??
            rules.excluded_genre_names?.[id] ??
            String(id),
        ]),
      ),
      dedup_hours: rules.dedup_hours,
      genre_names: genreNamesMap,
      artist_names: artistNamesMap,
      album_names: albumNamesMap,
    };
  }

  // Return combined interface with all exports from sub-composables
  return {
    rules,
    ...seedItems,
    ...genresComposable,
    ...contentFilters,
    ...yearRange,
    _updateTrackCount,
    getFinalRules,
  };
}

export type SmartPlaylistRulesFormContext = ReturnType<
  typeof useSmartPlaylistRulesForm
>;
