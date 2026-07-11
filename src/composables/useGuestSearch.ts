/**
 * Guest search composable for search, filtering, artist drill-down,
 * and infinite scroll on search results.
 *
 * Search runs through the progressive engine: the library and fast providers
 * show up right away and slower providers merge in while the guest watches.
 */

import { useProgressiveSearch } from "@/composables/useProgressiveSearch";
import { sortByRelevance } from "@/helpers/relevanceScoring";
import api from "@/plugins/api";
import { MediaType, type Artist, type Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 500;
const PAGE_SIZE = 10;

const dedupeKey = (item: Track | Artist): string | null => {
  if (!item.name) return null;
  if (item.media_type === MediaType.ARTIST)
    return `artist:${item.name.toLowerCase()}`;
  const artist =
    "artists" in item ? item.artists?.[0]?.name?.toLowerCase() || "" : "";
  return `track:${item.name.toLowerCase()}:${artist}`;
};

export function useGuestSearch() {
  // Search state
  const searchQuery = ref("");
  const hasSearched = ref(false);
  const searchFilter = ref<"all" | "track" | "artist">("all");
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const selectedMediaTypes = computed<MediaType[]>(() => {
    if (searchFilter.value === "track") return [MediaType.TRACK];
    if (searchFilter.value === "artist") return [MediaType.ARTIST];
    return [MediaType.TRACK, MediaType.ARTIST];
  });

  const {
    activeSearchTerm,
    loading: searching,
    searchResult,
    search,
  } = useProgressiveSearch({
    mediaTypes: selectedMediaTypes,
    allowedMediaTypes: [MediaType.TRACK, MediaType.ARTIST],
    limits: { single: 25, multi: 25 },
  });

  const searchResults = computed<(Track | Artist)[]>(() => {
    const result = searchResult.value;
    if (!result) return [];
    let combined: (Track | Artist)[];
    if (searchFilter.value === "track") {
      combined = result.tracks;
    } else if (searchFilter.value === "artist") {
      combined = result.artists;
    } else {
      combined = [...result.tracks, ...result.artists];
    }
    // Guests see no provider badges, so the same artist/track from several
    // providers reads as plain duplicates: keep the first occurrence only
    // (the engine merges library results first).
    const seen = new Set<string>();
    combined = combined.filter((item) => {
      const key = dedupeKey(item);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return sortByRelevance(combined, activeSearchTerm.value);
  });

  // Artist drill-down state
  const selectedArtist = ref<Artist | null>(null);
  const artistTracks = ref<Track[]>([]);
  const loadingArtistTracks = ref(false);

  // Infinite scroll state
  const resultsListRef = ref<HTMLElement | null>(null);
  const displayedResultsCount = ref(PAGE_SIZE);
  const displayedResults = computed(() =>
    searchResults.value.slice(0, displayedResultsCount.value),
  );

  // Helper to blur active element (hides mobile keyboard)
  const blurActiveElement = () => {
    (document.activeElement as HTMLElement)?.blur();
  };

  const performSearch = () => {
    if (!searchQuery.value || searchQuery.value.length < MIN_SEARCH_LENGTH)
      return;

    // Cancel any pending debounce to prevent double-fire when Enter triggers
    // an immediate search while a debounce timer is still pending
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }

    blurActiveElement();
    hasSearched.value = true;
    search(searchQuery.value);
  };

  const debouncedSearch = () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    if (searchQuery.value && searchQuery.value.length >= MIN_SEARCH_LENGTH) {
      searchDebounceTimer = setTimeout(() => {
        performSearch();
      }, SEARCH_DEBOUNCE_MS);
    }
  };

  // Watch for search query changes
  watch(searchQuery, (newQuery) => {
    if (!newQuery || newQuery.length < MIN_SEARCH_LENGTH) {
      if (hasSearched.value) {
        search("");
        hasSearched.value = false;
      }
    } else {
      debouncedSearch();
    }
  });

  // a new search or filter change starts the result list from the top
  watch([activeSearchTerm, searchFilter], () => {
    displayedResultsCount.value = PAGE_SIZE;
  });

  const clearSearch = () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchQuery.value = "";
    search("");
    displayedResultsCount.value = PAGE_SIZE;
    hasSearched.value = false;
    selectedArtist.value = null;
    artistTracks.value = [];
  };

  const selectArtist = async (artist: Artist) => {
    selectedArtist.value = artist;
    loadingArtistTracks.value = true;
    artistTracks.value = [];

    try {
      const providerMapping = artist.provider_mappings?.[0];
      if (!providerMapping) {
        throw new Error("No provider mapping found for artist");
      }

      const tracks = await api.getArtistTracks(
        providerMapping.item_id,
        providerMapping.provider_instance,
      );
      artistTracks.value = tracks;
    } catch (error) {
      console.error("Failed to fetch artist tracks:", error);
      toast.error($t("providers.party.guest_page.load_artist_tracks_failed"));
      selectedArtist.value = null;
    } finally {
      loadingArtistTracks.value = false;
    }
  };

  const clearArtistSelection = () => {
    selectedArtist.value = null;
    artistTracks.value = [];
  };

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target) return;

    const scrollPosition = target.scrollTop + target.clientHeight;
    const scrollHeight = target.scrollHeight;
    const threshold = 100;

    if (
      scrollPosition >= scrollHeight - threshold &&
      displayedResultsCount.value < searchResults.value.length
    ) {
      loadMoreResults();
    }
  };

  const loadMoreResults = () => {
    displayedResultsCount.value = Math.min(
      displayedResultsCount.value + PAGE_SIZE,
      searchResults.value.length,
    );
  };

  const cleanup = () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
  };

  return {
    searchQuery,
    searchResults,
    searching,
    hasSearched,
    searchFilter,
    selectedArtist,
    artistTracks,
    loadingArtistTracks,
    displayedResults,
    resultsListRef,
    displayedResultsCount,
    performSearch,
    clearSearch,
    selectArtist,
    clearArtistSelection,
    handleScroll,
    cleanup,
  };
}
