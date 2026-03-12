<template>
  <div class="guest-view">
    <!-- Search Section -->
    <PartyModeSearchBar
      v-model:search-query="searchQuery"
      v-model:search-filter="searchFilter"
      :has-searched="hasSearched"
      :show-back="hasSearched || !!selectedArtist"
      @clear="clearSearch"
      @back="goBack"
      @submit="performSearch"
    />

    <!-- Search Loading State -->
    <div v-if="searching && !selectedArtist" class="loading-state">
      <Spinner class="size-12 text-primary" />
      <p>{{ $t("providers.party.guest_page.searching") }}</p>
    </div>

    <!-- Artist Tracks View (when drilling into an artist) -->
    <div v-if="selectedArtist" class="results-section">
      <div class="section-header">
        <Button
          variant="ghost"
          size="sm"
          class="back-btn"
          @click="clearArtistSelection"
        >
          <ArrowLeft :size="16" />
          {{ $t("back") }}
        </Button>
        <h2 class="section-title artist-title">
          {{ selectedArtist.name }}
        </h2>
        <div v-if="rateLimitingEnabled" class="tokens-row">
          <PartyModeTokensBadge
            v-if="boostEnabled"
            :tokens="boostTokens"
            :max-tokens="BOOST_MAX_TOKENS"
            :countdown="nextTokenCountdown"
            :label="$t('providers.party.guest_page.boost_available')"
            :color="boostBadgeColor"
            icon="mdi-rocket-launch"
          />
          <PartyModeTokensBadge
            v-if="addQueueEnabled"
            :tokens="addQueueTokens"
            :max-tokens="ADD_QUEUE_MAX_TOKENS"
            :countdown="addQueueTokenCountdown"
            :label="$t('providers.party.guest_page.add_available')"
            :color="requestBadgeColor"
            icon="mdi-playlist-plus"
          />
        </div>
      </div>
      <!-- Loading state -->
      <div v-if="loadingArtistTracks" class="loading-state">
        <Spinner class="size-12 text-primary" />
        <p>{{ $t("providers.party.guest_page.loading_tracks") }}</p>
      </div>
      <!-- Artist tracks list -->
      <div v-else-if="artistTracks.length > 0" class="results-list">
        <PartyModeResultItem
          v-for="track in artistTracks"
          :key="`track-${track.item_id}`"
          :item="track"
          :boost-enabled="boostEnabled"
          :add-queue-enabled="addQueueEnabled"
          :rate-limiting-enabled="rateLimitingEnabled"
          :boost-tokens="boostTokens"
          :add-queue-tokens="addQueueTokens"
          :boost-badge-color="boostBadgeColor"
          :request-badge-color="requestBadgeColor"
          :adding-items="addingItems"
          :is-expanded="
            expandedResultItemId === `${track.media_type}-${track.item_id}`
          "
          @add-to-queue="addToQueue"
          @toggle-expand="toggleExpandedResult"
        />
      </div>
      <!-- Empty state for no tracks -->
      <div v-else class="empty-state">
        <Music :size="64" class="text-muted-foreground" />
        <p>{{ $t("providers.party.guest_page.no_tracks_for_artist") }}</p>
      </div>
    </div>

    <!-- Search Results -->
    <div
      v-else-if="!searching && searchResults.length > 0"
      class="results-section"
    >
      <div class="section-header">
        <h2 class="section-title">
          {{
            $t("providers.party.guest_page.search_results_count", [
              searchResults.length,
            ])
          }}
        </h2>
        <div v-if="rateLimitingEnabled" class="tokens-row">
          <PartyModeTokensBadge
            v-if="boostEnabled"
            :tokens="boostTokens"
            :max-tokens="BOOST_MAX_TOKENS"
            :countdown="nextTokenCountdown"
            :label="$t('providers.party.guest_page.boost_available')"
            :color="boostBadgeColor"
            icon="mdi-rocket-launch"
          />
          <PartyModeTokensBadge
            v-if="addQueueEnabled"
            :tokens="addQueueTokens"
            :max-tokens="ADD_QUEUE_MAX_TOKENS"
            :countdown="addQueueTokenCountdown"
            :label="$t('providers.party.guest_page.add_available')"
            :color="requestBadgeColor"
            icon="mdi-playlist-plus"
          />
        </div>
      </div>
      <div ref="resultsListRef" class="results-list" @scroll="handleScroll">
        <PartyModeResultItem
          v-for="item in displayedResults"
          :key="`${item.media_type}-${item.item_id}`"
          :item="item"
          :boost-enabled="boostEnabled"
          :add-queue-enabled="addQueueEnabled"
          :rate-limiting-enabled="rateLimitingEnabled"
          :boost-tokens="boostTokens"
          :add-queue-tokens="addQueueTokens"
          :boost-badge-color="boostBadgeColor"
          :request-badge-color="requestBadgeColor"
          :adding-items="addingItems"
          :is-expanded="
            expandedResultItemId === `${item.media_type}-${item.item_id}`
          "
          @add-to-queue="addToQueue"
          @select-artist="selectArtist"
          @toggle-expand="toggleExpandedResult"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="
        !searching &&
        hasSearched &&
        searchResults.length === 0 &&
        !selectedArtist
      "
      class="empty-state"
    >
      <Search :size="64" class="text-muted-foreground" />
      <p>
        {{ $t("providers.party.guest_page.no_results_for", [searchQuery]) }}
      </p>
      <p class="empty-hint">
        {{ $t("providers.party.guest_page.try_different_search") }}
      </p>
    </div>

    <!-- Current Queue Section -->
    <PartyModeQueueSection
      v-if="!selectedArtist && (!searchQuery || searchResults.length === 0)"
      ref="queueSectionRef"
      :queue-items="queueItems"
      :queue-fetch-offset="queueFetchOffset"
      :current-queue-index="currentQueueIndex"
      :is-playing="isPlaying"
      :loading-more-queue-items="loadingMoreQueueItems"
      :skip-song-enabled="skipSongEnabled"
      :rate-limiting-enabled="rateLimitingEnabled"
      :skip-song-tokens="skipSongTokens"
      :skipping-song="skippingSong"
      :skip-token-countdown="skipTokenCountdown"
      :boost-badge-color="boostBadgeColor"
      :request-badge-color="requestBadgeColor"
      :boost-enabled="boostEnabled"
      :boost-tokens="boostTokens"
      :boosting-item-id="boostingQueueItemId"
      @skip="skipCurrentSong"
      @queue-scroll="handleQueueScroll"
      @boost-queue-item="boostQueueItem"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  watch,
} from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  type Artist,
  EventType,
  PlaybackState,
  type QueueItem,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { toast } from "vue-sonner";
import { usePartyModeConfig } from "@/composables/usePartyModeConfig";
import { useRateLimiting } from "@/composables/useRateLimiting";
import { useGuestQueue } from "@/composables/useGuestQueue";
import { useGuestSearch } from "@/composables/useGuestSearch";
import PartyModeSearchBar from "@/components/party/PartyModeSearchBar.vue";
import PartyModeResultItem from "@/components/party/PartyModeResultItem.vue";
import PartyModeQueueSection from "@/components/party/PartyModeQueueSection.vue";
import PartyModeTokensBadge from "@/components/party/PartyModeTokensBadge.vue";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { ArrowLeft, Music, Search } from "lucide-vue-next";

// --- Composables ---
const { config: partyConfig, fetchConfig } = usePartyModeConfig();
const rateLimit = useRateLimiting();
const {
  rateLimitingEnabled,
  boostEnabled,
  addQueueEnabled,
  skipSongEnabled,
  requestBadgeColor,
  boostBadgeColor,
  boostTokens,
  addQueueTokens,
  skipSongTokens,
  BOOST_MAX_TOKENS,
  ADD_QUEUE_MAX_TOKENS,
  nextTokenCountdown,
  addQueueTokenCountdown,
  skipTokenCountdown,
  consumeBoostToken,
  consumeAddQueueToken,
  consumeSkipSongToken,
  getTimeUntilNextToken,
  getTimeUntilNextAddQueueToken,
  getTimeUntilNextSkipToken,
} = rateLimit;

const queue = useGuestQueue();
const {
  queueItems,
  queueFetchOffset,
  loadingMoreQueueItems,
  partyModeQueueId,
  currentQueueIndex,
  fetchQueueItems,
  handleQueueScroll,
} = queue;

const isPlaying = computed(
  () => store.activePlayer?.playback_state === PlaybackState.PLAYING,
);

const search = useGuestSearch();
const {
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
  performSearch,
  clearSearch,
  selectArtist,
  clearArtistSelection,
  handleScroll,
} = search;

// --- Template-specific state ---
const addingItems = ref(new Set<string>());
const skippingSong = ref(false);
const boostingQueueItemId = ref("");
const expandedResultItemId = ref("");

const toggleExpandedResult = (itemId: string) => {
  expandedResultItemId.value =
    expandedResultItemId.value === itemId ? "" : itemId;
};
const queueSectionRef = ref<InstanceType<typeof PartyModeQueueSection> | null>(
  null,
);

// Sync the queue section's listRef to the composable's queueListRef for auto-scroll
watch(
  () => queueSectionRef.value?.listRef,
  (el) => {
    queue.queueListRef.value = el ?? null;
  },
);

// --- Back navigation ---
const goBack = async () => {
  if (selectedArtist.value) {
    clearArtistSelection();
    return;
  }
  clearSearch();
  // Wait for the queue section to mount and expose its listRef
  // before attempting to scroll to the current item.
  await nextTick();
  queue.scrollToCurrentItem();
};

const handleBack = (event: PopStateEvent) => {
  if (
    selectedArtist.value ||
    searchQuery.value ||
    searchResults.value.length > 0
  ) {
    event.preventDefault();
    goBack();
    history.pushState(null, "", location.href);
  }
};

// --- Action glue (bridges rate limiting + API + snackbar) ---
const addToQueue = async (item: Track | Artist, position: "next" | "end") => {
  if (position === "next" && !boostEnabled.value) {
    toast.warning($t("providers.party.guest_page.boost_disabled"));
    return;
  }
  if (position === "end" && !addQueueEnabled.value) {
    toast.warning($t("providers.party.guest_page.add_queue_disabled"));
    return;
  }

  if (rateLimitingEnabled.value) {
    if (position === "next" && boostTokens.value <= 0) {
      const minutesUntilNext = getTimeUntilNextToken();
      toast.warning(
        $t("providers.party.guest_page.boost_limit_reached", [
          minutesUntilNext,
        ]),
      );
      return;
    }
    if (position === "end" && addQueueTokens.value <= 0) {
      const minutesUntilNext = getTimeUntilNextAddQueueToken();
      toast.warning(
        $t("providers.party.guest_page.add_queue_limit_reached", [
          minutesUntilNext,
        ]),
      );
      return;
    }
  }

  const key = `${item.media_type}-${item.item_id}-${position}`;
  addingItems.value.add(key);

  try {
    const result = (await api.sendCommand("party/add_to_queue", {
      uri: item.uri,
      boost: position === "next",
    })) as { success: boolean; boosted: boolean; started_playback: boolean };

    if (!result.success) {
      throw new Error("Server rejected the request");
    }

    if (rateLimitingEnabled.value) {
      if (position === "next") {
        consumeBoostToken();
      } else {
        consumeAddQueueToken();
      }
    }

    const message =
      position === "next"
        ? $t("providers.party.guest_page.item_boosted", [item.name])
        : $t("providers.party.guest_page.item_added_to_queue", [item.name]);
    toast.success(message);
  } catch (error) {
    console.error("Failed to add to queue:", error);
    toast.error($t("providers.party.guest_page.add_to_queue_failed"));
  } finally {
    addingItems.value.delete(key);
  }
};

const boostQueueItem = async (item: QueueItem) => {
  if (!boostEnabled.value) {
    toast.warning($t("providers.party.guest_page.boost_disabled"));
    return;
  }

  if (rateLimitingEnabled.value && boostTokens.value <= 0) {
    const minutesUntilNext = getTimeUntilNextToken();
    toast.warning(
      $t("providers.party.guest_page.boost_limit_reached", [minutesUntilNext]),
    );
    return;
  }

  boostingQueueItemId.value = item.queue_item_id;
  try {
    const result = (await api.sendCommand("party/boost_queue_item", {
      queue_item_id: item.queue_item_id,
    })) as { success: boolean };

    if (!result.success) {
      throw new Error("Server rejected the request");
    }

    if (rateLimitingEnabled.value) {
      consumeBoostToken();
    }

    const name = item.media_item?.name || item.name;
    toast.success($t("providers.party.guest_page.item_boosted", [name]));
  } catch (error) {
    console.error("Failed to boost queue item:", error);
    toast.error($t("providers.party.guest_page.add_to_queue_failed"));
  } finally {
    boostingQueueItemId.value = "";
  }
};

const skipCurrentSong = async () => {
  if (!skipSongEnabled.value) {
    toast.warning($t("providers.party.guest_page.skip_disabled"));
    return;
  }

  if (rateLimitingEnabled.value && skipSongTokens.value <= 0) {
    const minutesUntilNext = getTimeUntilNextSkipToken();
    toast.warning(
      $t("providers.party.guest_page.skip_limit_reached", [minutesUntilNext]),
    );
    return;
  }

  skippingSong.value = true;
  try {
    const result = (await api.sendCommand("party/skip")) as {
      success: boolean;
    };

    if (!result.success) {
      throw new Error("Server rejected the request");
    }

    if (rateLimitingEnabled.value) {
      consumeSkipSongToken();
    }

    toast.success($t("providers.party.guest_page.song_skipped"));
  } catch (error) {
    console.error("Failed to skip song:", error);
    toast.error($t("providers.party.guest_page.skip_failed"));
  } finally {
    skippingSong.value = false;
  }
};

// React to party config changes (e.g., admin changes rate limits or badge colors)
watch(partyConfig, (newConfig) => {
  if (newConfig) {
    rateLimit.configure(newConfig);
  }
});

// --- Lifecycle ---
let cleanupCountdown: (() => void) | null = null;
let cleanupQueueEvents: (() => void) | null = null;
let cleanupProvidersSub: (() => void) | null = null;

const refreshPartyPlayer = async () => {
  try {
    const partyPlayerId = await api.sendCommand<string | null>("party/player");
    partyModeQueueId.value = partyPlayerId;
    if (partyPlayerId) {
      store.activePlayerId = partyPlayerId;
    }
  } catch (error) {
    console.error("Failed to fetch party player:", error);
  }
};

const fetchAndApplyConfig = async () => {
  const config = await fetchConfig();
  if (config) {
    rateLimit.configure(config);
  }
};

onMounted(async () => {
  await fetchAndApplyConfig();

  history.pushState(null, "", location.href);
  window.addEventListener("popstate", handleBack);

  cleanupCountdown = rateLimit.startCountdown();

  await refreshPartyPlayer();

  fetchQueueItems();
  cleanupQueueEvents = queue.subscribeToEvents();

  // Re-fetch player when party config changes
  const unsubProviders = api.subscribe(
    EventType.PROVIDERS_UPDATED,
    async () => {
      await refreshPartyPlayer();
      fetchQueueItems(true);
    },
  );
  cleanupProvidersSub = unsubProviders;
});

onBeforeUnmount(() => {
  window.removeEventListener("popstate", handleBack);
  cleanupQueueEvents?.();
  cleanupCountdown?.();
  cleanupProvidersSub?.();
  search.cleanup();
});
</script>

<style scoped>
.guest-view {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0));
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.2);
  flex: 1;
}

.tokens-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.results-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-section .section-header {
  flex-shrink: 0;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  padding-right: 0.5rem;
}

.back-btn {
  flex-shrink: 0;
}

.artist-title {
  flex: 1;
  text-align: center;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  opacity: 0.7;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  opacity: 0.6;
}

.empty-state p {
  font-size: 1.125rem;
  margin-top: 1rem;
}

.empty-hint {
  font-size: 0.875rem;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .guest-view {
    padding: 0.75rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0));
  }

  .section-header {
    margin-bottom: 0.5rem;
  }

  .section-title {
    font-size: 1.1rem;
    padding-bottom: 0.25rem;
  }

  .results-list {
    gap: 0.5rem;
    padding-right: 0.25rem;
  }
}
</style>
