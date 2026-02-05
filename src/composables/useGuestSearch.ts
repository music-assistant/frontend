/**
 * Guest search composable for search, filtering, artist drill-down,
 * and infinite scroll on search results.
 */

import { ref, computed, watch } from "vue";
import api from "@/plugins/api";
import { MediaType, type Artist, type Track } from "@/plugins/api/interfaces";
import { sortByRelevance } from "@/helpers/relevanceScoring";

export function useGuestSearch(options: {
  showSnackbar: (message: string, color?: string) => void;
}) {
  // Search state
  const searchQuery = ref("");
  const searchResults = ref<(Track | Artist)[]>([]);
  const searching = ref(false);
  const hasSearched = ref(false);
  const searchFilter = ref<"all" | "track" | "artist">("all");
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Artist drill-down state
  const selectedArtist = ref<Artist | null>(null);
  const artistTracks = ref<Track[]>([]);
  const loadingArtistTracks = ref(false);

  // Infinite scroll state
  const resultsListRef = ref<HTMLElement | null>(null);
  const displayedResultsCount = ref(10);
  const loadingMoreResults = ref(false);
  const displayedResults = computed(() =>
    searchResults.value.slice(0, displayedResultsCount.value),
  );

  // Helper to blur active element (hides mobile keyboard)
  const blurActiveElement = () => {
    (document.activeElement as HTMLElement)?.blur();
  };

  const performSearch = async () => {
    if (!searchQuery.value || searchQuery.value.length < 2) return;

    // Cancel any pending debounce to prevent double-fire when Enter triggers
    // an immediate search while a debounce timer is still pending
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }

    blurActiveElement();

    searching.value = true;
    hasSearched.value = true;
    try {
      const mediaTypes: MediaType[] = [];
      if (searchFilter.value === "all" || searchFilter.value === "track") {
        mediaTypes.push(MediaType.TRACK);
      }
      if (searchFilter.value === "all" || searchFilter.value === "artist") {
        mediaTypes.push(MediaType.ARTIST);
      }

      const results = await api.search(searchQuery.value, mediaTypes);

      let combinedResults: (Track | Artist)[];
      if (searchFilter.value === "track") {
        combinedResults = results.tracks;
      } else if (searchFilter.value === "artist") {
        combinedResults = results.artists;
      } else {
        combinedResults = [...results.tracks, ...results.artists];
      }

      searchResults.value = sortByRelevance(combinedResults, searchQuery.value);
      displayedResultsCount.value = 10;
    } catch (error) {
      console.error("Search failed:", error);
      options.showSnackbar("Search failed", "error");
    } finally {
      searching.value = false;
    }
  };

  const debouncedSearch = () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    if (searchQuery.value && searchQuery.value.length >= 2) {
      searchDebounceTimer = setTimeout(() => {
        performSearch();
      }, 1000);
    }
  };

  // Watch for search query changes
  watch(searchQuery, (newQuery) => {
    if (!newQuery || newQuery.length < 2) {
      if (hasSearched.value) {
        searchResults.value = [];
        hasSearched.value = false;
      }
    } else {
      debouncedSearch();
    }
  });

  // Watch for filter changes and re-search
  watch(searchFilter, () => {
    if (searchQuery.value && searchQuery.value.length >= 2) {
      performSearch();
    }
  });

  const clearSearch = () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchQuery.value = "";
    searchResults.value = [];
    displayedResultsCount.value = 10;
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
      options.showSnackbar("Failed to load artist tracks", "error");
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
      !loadingMoreResults.value &&
      displayedResultsCount.value < searchResults.value.length
    ) {
      loadMoreResults();
    }
  };

  const loadMoreResults = () => {
    loadingMoreResults.value = true;

    setTimeout(() => {
      const increment = 10;
      const newCount = Math.min(
        displayedResultsCount.value + increment,
        searchResults.value.length,
      );
      displayedResultsCount.value = newCount;
      loadingMoreResults.value = false;
    }, 300);
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
    loadingMoreResults,
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
