<template>
  <div class="guest-view">
    <!-- Search Section -->
    <div class="search-section">
      <v-text-field
        v-model="searchQuery"
        :placeholder="$t('guest.search_placeholder')"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="comfortable"
        clearable
        autofocus
        hide-details
        inputmode="search"
        enterkeyhint="search"
        class="search-input"
        @keyup.enter="performSearch"
        @click:clear="clearSearch"
      />
      <v-btn
        color="primary"
        size="large"
        :loading="searching"
        :disabled="!searchQuery || searchQuery.length < 2"
        class="search-btn"
        @click="performSearch"
      >
        {{ $t("search") }}
      </v-btn>
    </div>

    <!-- Search Filter Chips -->
    <div v-if="hasSearched || searchQuery.length >= 2" class="filter-section">
      <v-chip-group
        v-model="searchFilter"
        mandatory
        selected-class="filter-active"
      >
        <v-chip value="all" variant="outlined" size="small" class="filter-chip">
          {{ $t("searchtype_all") }}
        </v-chip>
        <v-chip
          value="track"
          variant="outlined"
          size="small"
          class="filter-chip"
        >
          <v-icon start size="small">mdi-music-note</v-icon>
          {{ $t("guest.filter_songs") }}
        </v-chip>
        <v-chip
          value="artist"
          variant="outlined"
          size="small"
          class="filter-chip"
        >
          <v-icon start size="small">mdi-account-music</v-icon>
          {{ $t("artists") }}
        </v-chip>
      </v-chip-group>
    </div>

    <!-- Artist Tracks View (when drilling into an artist) -->
    <div v-if="selectedArtist" class="results-section">
      <div class="section-header">
        <v-btn
          variant="text"
          color="primary"
          class="back-btn"
          @click="clearArtistSelection"
        >
          <v-icon start>mdi-arrow-left</v-icon>
          {{ $t("back") }}
        </v-btn>
        <h2 class="section-title artist-title">
          {{ selectedArtist.name }}
        </h2>
        <div v-if="rateLimitingEnabled" class="boost-tokens">
          <v-icon size="small" color="primary">mdi-timer-sand</v-icon>
          <span class="token-count"
            >{{ boostTokens }}/{{ BOOST_MAX_TOKENS }}</span
          >
          <span class="token-label">{{ $t("guest.boost_available") }}</span>
          <span
            v-if="boostTokens < BOOST_MAX_TOKENS && nextTokenCountdown"
            class="token-countdown"
          >
            <v-icon size="x-small">mdi-clock-outline</v-icon>
            {{ nextTokenCountdown }}
          </span>
        </div>
      </div>
      <!-- Loading state -->
      <div v-if="loadingArtistTracks" class="loading-artist-tracks">
        <v-progress-circular indeterminate color="primary" size="48" />
        <p>{{ $t("guest.loading_tracks") }}</p>
      </div>
      <!-- Artist tracks list -->
      <div v-else-if="artistTracks.length > 0" class="results-list">
        <div
          v-for="track in artistTracks"
          :key="`track-${track.item_id}`"
          class="result-item"
        >
          <div class="result-info">
            <v-avatar size="56" rounded class="result-avatar">
              <v-img :src="getImageUrl(track)" :alt="track.name" cover>
                <template #placeholder>
                  <div class="avatar-placeholder">
                    <v-icon>mdi-music</v-icon>
                  </div>
                </template>
              </v-img>
            </v-avatar>
            <div class="result-text">
              <MarqueeText class="result-name">
                {{ track.name }}
              </MarqueeText>
              <MarqueeText class="result-artist">
                {{ getArtistName(track) }}
              </MarqueeText>
            </div>
          </div>
          <div class="result-actions">
            <v-btn
              v-if="boostEnabled"
              variant="elevated"
              :loading="addingItems.has(`track-${track.item_id}-next`)"
              :disabled="rateLimitingEnabled && boostTokens <= 0"
              class="action-btn"
              :style="{ backgroundColor: boostBadgeColor, color: '#fff' }"
              @click="addToQueue(track, 'next')"
            >
              <v-icon start>mdi-rocket-launch</v-icon>
              {{ $t("guest.boost") }}
            </v-btn>
            <v-btn
              v-if="addQueueEnabled"
              variant="elevated"
              :loading="addingItems.has(`track-${track.item_id}-end`)"
              :disabled="rateLimitingEnabled && addQueueTokens <= 0"
              class="action-btn"
              :style="{ backgroundColor: requestBadgeColor, color: '#fff' }"
              @click="addToQueue(track, 'end')"
            >
              <v-icon start>mdi-playlist-plus</v-icon>
              {{ $t("guest.add") }}
            </v-btn>
          </div>
        </div>
      </div>
      <!-- Empty state for no tracks -->
      <div v-else class="empty-state">
        <v-icon size="64" color="grey">mdi-music-off</v-icon>
        <p>{{ $t("guest.no_tracks_for_artist") }}</p>
      </div>
    </div>

    <!-- Search Results -->
    <div v-else-if="searchResults.length > 0" class="results-section">
      <div class="section-header">
        <h2 class="section-title">
          {{ $t("guest.search_results_count", [searchResults.length]) }}
        </h2>
        <div v-if="rateLimitingEnabled" class="boost-tokens">
          <v-icon size="small" color="primary">mdi-timer-sand</v-icon>
          <span class="token-count"
            >{{ boostTokens }}/{{ BOOST_MAX_TOKENS }}</span
          >
          <span class="token-label">{{ $t("guest.boost_available") }}</span>
          <span
            v-if="boostTokens < BOOST_MAX_TOKENS && nextTokenCountdown"
            class="token-countdown"
          >
            <v-icon size="x-small">mdi-clock-outline</v-icon>
            {{ nextTokenCountdown }}
          </span>
        </div>
      </div>
      <div ref="resultsListRef" class="results-list" @scroll="handleScroll">
        <div
          v-for="item in displayedResults"
          :key="`${item.media_type}-${item.item_id}`"
          class="result-item"
        >
          <div class="result-info">
            <v-avatar size="56" rounded class="result-avatar">
              <v-img :src="getImageUrl(item)" :alt="item.name" cover>
                <template #placeholder>
                  <div class="avatar-placeholder">
                    <v-icon>mdi-music</v-icon>
                  </div>
                </template>
              </v-img>
            </v-avatar>
            <div class="result-text">
              <MarqueeText class="result-name">
                {{ item.name }}
              </MarqueeText>
              <MarqueeText class="result-artist">
                {{ getArtistName(item) }}
                <span v-if="item.media_type === 'artist'" class="result-type">
                  • {{ $t("artist") }}
                </span>
              </MarqueeText>
            </div>
          </div>
          <!-- Actions for tracks -->
          <div v-if="item.media_type === 'track'" class="result-actions">
            <v-btn
              v-if="boostEnabled"
              variant="elevated"
              :loading="
                addingItems.has(`${item.media_type}-${item.item_id}-next`)
              "
              :disabled="rateLimitingEnabled && boostTokens <= 0"
              class="action-btn"
              :style="{ backgroundColor: boostBadgeColor, color: '#fff' }"
              @click="addToQueue(item, 'next')"
            >
              <v-icon start>mdi-rocket-launch</v-icon>
              {{ $t("guest.boost") }}
            </v-btn>
            <v-btn
              v-if="addQueueEnabled"
              variant="elevated"
              :loading="
                addingItems.has(`${item.media_type}-${item.item_id}-end`)
              "
              :disabled="rateLimitingEnabled && addQueueTokens <= 0"
              class="action-btn"
              :style="{ backgroundColor: requestBadgeColor, color: '#fff' }"
              @click="addToQueue(item, 'end')"
            >
              <v-icon start>mdi-playlist-plus</v-icon>
              {{ $t("guest.add") }}
            </v-btn>
          </div>
          <!-- Actions for artists - drill down to see tracks -->
          <div v-else-if="item.media_type === 'artist'" class="result-actions">
            <v-btn
              color="primary"
              variant="elevated"
              class="action-btn action-btn-primary"
              @click="selectArtist(item)"
            >
              <v-icon start>mdi-music-note-outline</v-icon>
              {{ $t("guest.view_songs") }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State - only show when a search has completed with no results -->
    <div
      v-else-if="
        !searching &&
        hasSearched &&
        searchResults.length === 0 &&
        !selectedArtist
      "
      class="empty-state"
    >
      <v-icon size="64" color="grey">mdi-magnify</v-icon>
      <p>{{ $t("guest.no_results_for", [searchQuery]) }}</p>
      <p class="empty-hint">{{ $t("guest.try_different_search") }}</p>
    </div>

    <!-- Current Queue Section - Hidden when search results or artist tracks are showing -->
    <div
      v-if="!selectedArtist && (!searchQuery || searchResults.length === 0)"
      class="queue-section"
    >
      <h2 class="section-title">{{ $t("guest.current_queue") }}</h2>
      <div
        v-if="queueItems.length > 0"
        ref="queueListRef"
        class="queue-list"
        @scroll="handleQueueScroll"
      >
        <div
          v-for="(item, index) in queueItems"
          :key="item.queue_item_id"
          class="queue-item"
          :class="{
            'queue-item-current':
              queueFetchOffset + index === currentQueueIndex,
            'queue-item-played': queueFetchOffset + index < currentQueueIndex,
          }"
        >
          <div class="queue-position">
            <NowPlayingBadge
              v-if="queueFetchOffset + index === currentQueueIndex && isPlaying"
              :show-badge="false"
            />
            <v-icon
              v-else-if="queueFetchOffset + index === currentQueueIndex"
              color="primary"
            >
              mdi-pause-circle
            </v-icon>
            <span v-else class="queue-number">{{
              queueFetchOffset + index + 1
            }}</span>
          </div>
          <v-avatar size="48" rounded class="queue-avatar">
            <v-img :src="getQueueItemImageUrl(item)" :alt="item.name" cover>
              <template #placeholder>
                <div class="avatar-placeholder">
                  <v-icon>mdi-music</v-icon>
                </div>
              </template>
            </v-img>
          </v-avatar>
          <div class="queue-info">
            <MarqueeText class="queue-name">
              {{ getQueueItemTitle(item) }}
            </MarqueeText>
            <MarqueeText class="queue-artist">
              {{ getQueueItemSubtitle(item) }}
            </MarqueeText>
          </div>
          <!-- Guest request badge (right aligned) -->
          <span
            v-if="item.extra_attributes?.added_by_user_role === 'guest'"
            class="guest-request-badge"
            :style="{
              '--badge-color':
                item.extra_attributes?.queue_option === 'next'
                  ? boostBadgeColor
                  : requestBadgeColor,
            }"
          >
            <v-icon size="x-small">{{
              item.extra_attributes?.queue_option === "next"
                ? "mdi-rocket-launch"
                : "mdi-account-music"
            }}</v-icon>
            <span>{{
              item.extra_attributes?.queue_option === "next"
                ? $t("guest.boost")
                : $t("guest.request")
            }}</span>
          </span>
          <!-- Skip button for currently playing item -->
          <div
            v-if="
              skipSongEnabled && queueFetchOffset + index === currentQueueIndex
            "
            class="queue-item-actions"
          >
            <v-btn
              color="secondary"
              variant="flat"
              size="small"
              :loading="skippingSong"
              :disabled="rateLimitingEnabled && skipSongTokens <= 0"
              class="skip-btn"
              @click="skipCurrentSong"
            >
              <v-icon start size="small">mdi-skip-next</v-icon>
              {{ $t("guest.skip") }}
              <span
                v-if="rateLimitingEnabled"
                class="skip-token-badge"
                :class="{ 'no-tokens': skipSongTokens <= 0 }"
              >
                {{ skipSongTokens }}
              </span>
            </v-btn>
            <span
              v-if="
                rateLimitingEnabled && skipSongTokens <= 0 && skipTokenCountdown
              "
              class="skip-countdown"
            >
              <v-icon size="x-small">mdi-clock-outline</v-icon>
              {{ skipTokenCountdown }}
            </span>
          </div>
        </div>
        <!-- Loading indicator for infinite scroll -->
        <div v-if="loadingMoreQueueItems" class="loading-more">
          <v-progress-circular indeterminate color="primary" size="32" />
        </div>
      </div>
      <div v-else class="empty-queue">
        <v-icon size="48" color="grey">mdi-playlist-music-outline</v-icon>
        <p>{{ $t("guest.queue_empty") }}</p>
      </div>
    </div>

    <!-- Snackbar for feedback -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">
          {{ $t("close") }}
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  type Artist,
  type PartyModeConfig,
  type QueueItem,
  MediaType,
  PlaybackState,
  QueueOption,
  type Track,
} from "@/plugins/api/interfaces";
import { getMediaItemImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { useRateLimiting } from "@/composables/useRateLimiting";
import { useGuestQueue } from "@/composables/useGuestQueue";
import { useGuestSearch } from "@/composables/useGuestSearch";
import MarqueeText from "@/components/MarqueeText.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";

// --- Snackbar ---
const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

const showSnackbar = (message: string, color: string = "success") => {
  snackbar.value = { show: true, message, color };
};

const isPlaying = computed(
  () => store.activePlayer?.playback_state === PlaybackState.PLAYING,
);

// --- Composables ---
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
  SKIP_SONG_MAX_TOKENS,
  nextTokenCountdown,
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
  queueListRef,
  queueFetchOffset,
  queueTotalItems,
  loadingMoreQueueItems,
  partyModeQueueId,
  currentQueue,
  currentQueueIndex,
  fetchQueueItems,
  handleQueueScroll,
} = queue;

const search = useGuestSearch({
  showSnackbar: (msg, color) => showSnackbar(msg, color),
});
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
  displayedResultsCount,
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

// --- Back button handler ---
const handleBack = (event: PopStateEvent) => {
  if (selectedArtist.value) {
    event.preventDefault();
    clearArtistSelection();
    history.pushState(null, "", location.href);
    return;
  }
  if (searchQuery.value || searchResults.value.length > 0) {
    event.preventDefault();
    clearSearch();
    history.pushState(null, "", location.href);
  }
};

// --- Display helpers ---
const getImageUrl = (item: Track | Artist) => {
  const img = item.metadata?.images?.[0];
  return img ? getMediaItemImageUrl(img) : "";
};

const getQueueItemImageUrl = (item: QueueItem) => {
  if (!item.image) return "";
  return getMediaItemImageUrl(item.image);
};

const getArtistName = (item: Track | Artist) => {
  if (item.media_type === MediaType.ARTIST) {
    return $t("artist");
  }
  if ("artists" in item && item.artists.length > 0) {
    return item.artists.map((a) => a.name).join(", ");
  }
  return $t("guest.unknown_artist");
};

const getQueueItemTitle = (item: QueueItem) => {
  if (item.media_item?.name) {
    return item.media_item.name;
  }
  return item.name;
};

const getQueueItemSubtitle = (item: QueueItem) => {
  const mediaItem = item.media_item;
  const parts: string[] = [];

  if (mediaItem && "artists" in mediaItem && mediaItem.artists.length > 0) {
    parts.push(mediaItem.artists.map((a) => a.name).join(", "));
  }

  if (mediaItem && "album" in mediaItem && mediaItem.album?.name) {
    parts.push(mediaItem.album.name);
  }

  return parts.length > 0 ? parts.join(" • ") : $t("guest.unknown_artist");
};

// --- Action glue (bridges rate limiting + API + snackbar) ---
const addToQueue = async (item: Track | Artist, position: "next" | "end") => {
  if (position === "next" && !boostEnabled.value) {
    showSnackbar($t("guest.boost_disabled"), "warning");
    return;
  }
  if (position === "end" && !addQueueEnabled.value) {
    showSnackbar($t("guest.add_queue_disabled"), "warning");
    return;
  }

  if (rateLimitingEnabled.value) {
    if (position === "next") {
      if (!consumeBoostToken()) {
        const minutesUntilNext = getTimeUntilNextToken();
        showSnackbar(
          $t("guest.boost_limit_reached", [minutesUntilNext]),
          "warning",
        );
        return;
      }
    } else {
      if (!consumeAddQueueToken()) {
        const minutesUntilNext = getTimeUntilNextAddQueueToken();
        showSnackbar(
          $t("guest.add_queue_limit_reached", [minutesUntilNext]),
          "warning",
        );
        return;
      }
    }
  }

  const key = `${item.media_type}-${item.item_id}-${position}`;
  addingItems.value.add(key);

  try {
    // Use the party mode API endpoint for server-side validation
    const result = (await api.sendCommand("party_mode/add_to_queue", {
      uri: item.uri,
      boost: position === "next",
    })) as { success: boolean; boosted: boolean; started_playback: boolean };

    if (!result.success) {
      throw new Error("Server rejected the request");
    }

    const message =
      position === "next"
        ? $t("guest.item_boosted", [item.name])
        : $t("guest.item_added_to_queue", [item.name]);
    showSnackbar(message, "success");
  } catch (error) {
    console.error("Failed to add to queue:", error);
    showSnackbar($t("guest.add_to_queue_failed"), "error");
  } finally {
    addingItems.value.delete(key);
  }
};

const skipCurrentSong = async () => {
  if (!skipSongEnabled.value) {
    showSnackbar($t("guest.skip_disabled"), "warning");
    return;
  }

  if (rateLimitingEnabled.value) {
    if (!consumeSkipSongToken()) {
      const minutesUntilNext = getTimeUntilNextSkipToken();
      showSnackbar(
        $t("guest.skip_limit_reached", [minutesUntilNext]),
        "warning",
      );
      return;
    }
  }

  skippingSong.value = true;
  try {
    // Use the party mode API endpoint for server-side validation
    const result = (await api.sendCommand("party_mode/skip")) as {
      success: boolean;
    };

    if (!result.success) {
      throw new Error("Server rejected the request");
    }

    showSnackbar($t("guest.song_skipped"), "success");
  } catch (error) {
    console.error("Failed to skip song:", error);
    showSnackbar($t("guest.skip_failed"), "error");
  } finally {
    skippingSong.value = false;
  }
};

// --- Lifecycle ---
let cleanupCountdown: (() => void) | null = null;
let cleanupQueueEvents: (() => void) | null = null;

const fetchAndApplyConfig = async () => {
  try {
    const config = (await api.sendCommand(
      "party_mode/config",
    )) as PartyModeConfig;
    if (config) {
      rateLimit.configure(config);
    }
  } catch (error) {
    console.error("Failed to fetch party mode config:", error);
  }
};

onMounted(async () => {
  await fetchAndApplyConfig();

  // Push initial state to enable back interception
  history.pushState(null, "", location.href);
  window.addEventListener("popstate", handleBack);

  // Initialize token buckets and start countdown
  cleanupCountdown = rateLimit.startCountdown();

  // Fetch party mode player configuration
  try {
    partyModeQueueId.value = await api.sendCommand("party_mode/player");
  } catch (error) {
    console.error("Failed to fetch party mode player:", error);
  }

  // Initial queue fetch and event subscriptions
  fetchQueueItems();
  cleanupQueueEvents = queue.subscribeToEvents();
});

onBeforeUnmount(() => {
  window.removeEventListener("popstate", handleBack);
  cleanupQueueEvents?.();
  cleanupCountdown?.();
  search.cleanup();
});
</script>

<style scoped>
.guest-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
  /* Add safe area padding for mobile devices with browser UI */
  padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0));
  /* Use dvh (dynamic viewport height) to account for mobile browser UI */
  /* max-height ensures content doesn't exceed viewport */
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.search-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
}

.filter-section {
  display: flex;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.filter-chip {
  font-weight: 500;
  transition: all 0.2s ease;
}

.filter-active {
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  border-color: rgb(var(--v-theme-primary)) !important;
}

.search-btn {
  min-width: 120px;
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

.boost-tokens {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 20px;
  border: 1px solid rgba(var(--v-theme-primary), 0.3);
}

.token-count {
  font-weight: 700;
  font-size: 1rem;
  color: rgb(var(--v-theme-primary));
}

.token-label {
  font-size: 0.875rem;
  opacity: 0.8;
}

.token-countdown {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--v-theme-secondary));
  padding-left: 0.5rem;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.2);
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

.loading-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(var(--v-theme-surface-variant), 0.25);
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  min-height: 72px;
}

.result-item:hover {
  background: rgba(var(--v-theme-surface-variant), 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.result-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.result-avatar,
.queue-avatar {
  flex-shrink: 0;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-primary), 0.1);
}

.result-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.result-name,
.result-artist,
.queue-name,
.queue-artist {
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result-type {
  text-transform: capitalize;
  opacity: 0.7;
}

.result-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}

.back-btn {
  flex-shrink: 0;
}

.artist-title {
  flex: 1;
  text-align: center;
}

.loading-artist-tracks {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  opacity: 0.7;
}

.action-btn {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
}

.action-btn-primary {
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.4) !important;
}

.action-btn-primary:hover {
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.6) !important;
  transform: translateY(-1px);
}

.action-btn-secondary {
  background: rgb(var(--v-theme-secondary)) !important;
  color: rgb(var(--v-theme-on-secondary)) !important;
}

.action-btn-secondary:hover {
  background: rgba(var(--v-theme-secondary), 0.85) !important;
  transform: translateY(-1px);
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

.queue-section {
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  /* Fill remaining space */
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.queue-section .section-title {
  flex: none;
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.2);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  /* Fill remaining space in queue-section */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 8px;
  min-height: 64px;
  transition: all 0.2s ease;
}

.queue-item-current {
  background: rgba(var(--v-theme-primary), 0.15);
  border-left: 3px solid rgb(var(--v-theme-primary));
  padding-left: calc(0.75rem - 3px);
}

.queue-item-played {
  background: rgba(0, 0, 0, 0.2);
  opacity: 0.5;
}

.queue-position {
  width: 32px;
  text-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.queue-position :deep(.now-playing-icon) {
  margin: 0;
}

.queue-number {
  font-size: 0.875rem;
  opacity: 0.6;
}

.queue-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.guest-request-badge {
  /* Color set via inline style from config; CSS fallback only if style missing */
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: color-mix(in srgb, var(--badge-color) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--badge-color);
  flex-shrink: 0;
  margin-left: auto;
}

.queue-item-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}

.skip-btn {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
}

.skip-token-badge {
  margin-left: 0.5rem;
  padding: 0.125rem 0.375rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
}

.skip-token-badge.no-tokens {
  background: rgba(255, 100, 100, 0.3);
}

.skip-countdown {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.empty-queue {
  text-align: center;
  padding: 2rem;
  opacity: 0.5;
}

@media (max-width: 768px) {
  .guest-view {
    padding: 0.75rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0));
  }

  .search-section {
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .filter-section {
    margin-bottom: 0.75rem;
  }

  .filter-chip {
    font-size: 0.75rem;
  }

  .section-header {
    margin-bottom: 0.5rem;
  }

  .section-title {
    font-size: 1.25rem;
    padding-bottom: 0.25rem;
  }

  .boost-tokens {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .boost-tokens .token-label {
    display: none;
  }

  .boost-tokens .token-countdown {
    padding-left: 0.375rem;
    border-left: none;
  }

  .result-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    min-height: auto;
    padding: 0.75rem;
  }

  .results-list {
    gap: 0.5rem;
    padding-right: 0.25rem;
  }

  .result-info {
    width: 100%;
    overflow: visible;
  }

  .result-text {
    overflow: hidden;
  }

  .result-actions {
    width: 100%;
    flex-direction: row;
    margin-left: 0;
  }

  .result-actions .v-btn {
    flex: 1;
  }
}
</style>
