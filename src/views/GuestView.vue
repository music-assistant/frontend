<template>
  <div class="guest-view">
    <!-- Search Section -->
    <div class="search-section">
      <v-text-field
        v-model="searchQuery"
        placeholder="Search for songs, artists, or albums..."
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="comfortable"
        clearable
        autofocus
        hide-details
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
        Search
      </v-btn>
    </div>

    <!-- Search Results -->
    <div v-if="searchResults.length > 0" class="results-section">
      <div class="section-header">
        <h2 class="section-title">
          Search Results ({{ searchResults.length }})
        </h2>
        <div v-if="rateLimitingEnabled" class="play-next-tokens">
          <v-icon size="small" color="primary">mdi-timer-sand</v-icon>
          <span class="token-count"
            >{{ playNextTokens }}/{{ PLAY_NEXT_MAX_TOKENS }}</span
          >
          <span class="token-label">Play Next available</span>
          <span
            v-if="playNextTokens < PLAY_NEXT_MAX_TOKENS && nextTokenCountdown"
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
              <div class="result-name scroll-text">
                <span>{{ item.name }}</span>
              </div>
              <div class="result-artist scroll-text">
                <span>{{ getArtistName(item) }}</span>
                <span v-if="item.media_type !== 'track'" class="result-type">
                  • {{ formatMediaType(item.media_type) }}
                </span>
              </div>
            </div>
          </div>
          <div class="result-actions">
            <v-btn
              v-if="addQueueEnabled"
              color="primary"
              variant="elevated"
              :loading="
                addingItems.has(`${item.media_type}-${item.item_id}-end`)
              "
              :disabled="rateLimitingEnabled && addQueueTokens <= 0"
              class="action-btn action-btn-primary"
              @click="addToQueue(item, 'end')"
            >
              <v-icon start>mdi-playlist-plus</v-icon>
              Add
            </v-btn>
            <v-btn
              v-if="playNextEnabled"
              color="secondary"
              variant="flat"
              :loading="
                addingItems.has(`${item.media_type}-${item.item_id}-next`)
              "
              :disabled="rateLimitingEnabled && playNextTokens <= 0"
              class="action-btn action-btn-secondary"
              @click="addToQueue(item, 'next')"
            >
              <v-icon start>mdi-playlist-play</v-icon>
              Next
            </v-btn>
          </div>
        </div>
        <!-- Loading indicator for infinite scroll -->
        <div v-if="loadingMoreResults" class="loading-more">
          <v-progress-circular indeterminate color="primary" size="32" />
        </div>
      </div>
    </div>

    <!-- Empty State - only show when a search has completed with no results -->
    <div
      v-else-if="!searching && hasSearched && searchResults.length === 0"
      class="empty-state"
    >
      <v-icon size="64" color="grey">mdi-magnify</v-icon>
      <p>No results found for "{{ searchQuery }}"</p>
      <p class="empty-hint">Try a different search term</p>
    </div>

    <!-- Initial State -->
    <!-- <div v-else-if="!searching && !searchQuery" class="empty-state">
      <v-icon size="64" color="primary">mdi-music-note-plus</v-icon>
      <p>Start searching to add songs to the queue</p>
      <p class="empty-hint">
        Search for your favorite tracks, artists, or albums
      </p>
    </div> -->

    <!-- Current Queue Section - Hidden when search results are showing -->
    <div
      v-if="!searchQuery || searchResults.length === 0"
      class="queue-section"
    >
      <h2 class="section-title">Current Queue</h2>
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
          }"
        >
          <div class="queue-position">
            <v-icon
              v-if="queueFetchOffset + index === currentQueueIndex"
              color="primary"
            >
              mdi-play-circle
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
            <div class="queue-name scroll-text">
              <span>{{ item.name }}</span>
            </div>
            <div class="queue-artist scroll-text">
              <span>{{ getQueueItemArtist(item) }}</span>
            </div>
          </div>
          <!-- Guest request badge (right aligned) -->
          <span
            v-if="item.added_by_user_role === 'guest'"
            class="guest-request-badge"
            :style="{
              '--badge-color':
                item.queue_option === 'next'
                  ? playNextBadgeColor
                  : requestBadgeColor,
            }"
          >
            <v-icon size="x-small">{{
              item.queue_option === "next"
                ? "mdi-playlist-play"
                : "mdi-account-music"
            }}</v-icon>
            <span>{{
              item.queue_option === "next" ? "Play Next" : "Request"
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
              Skip
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
        <p>Queue is empty</p>
      </div>
    </div>

    <!-- Snackbar for feedback -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false"> Close </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
} from "vue";
import { useRouter } from "vue-router";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  EventType,
  EventMessage,
  PlayerQueue,
  QueueItem,
  MediaType,
  QueueOption,
} from "@/plugins/api/interfaces";
import { getMediaItemImageUrl } from "@/helpers/utils";

const router = useRouter();
const handleBack = (event: PopStateEvent) => {
  if (searchQuery.value || searchResults.value.length > 0) {
    event.preventDefault(); // Prevent leaving
    clearSearch();
    // Push state so the user can press back again if needed
    history.pushState(null, "", location.href);
  }
};

// Responsive state
const isMobile = computed(() => store.mobileLayout);

// Search state
const searchQuery = ref("");
const searchResults = ref<any[]>([]);
const searching = ref(false);
const addingItems = ref(new Set<string>());
const hasSearched = ref(false); // Track if a search has been performed
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Infinite scroll state
const resultsListRef = ref<HTMLElement | null>(null);
const displayedResultsCount = ref(10); // Start with 10 results
const loadingMoreResults = ref(false);
const displayedResults = computed(() =>
  searchResults.value.slice(0, displayedResultsCount.value),
);

// Rate limiting - Token bucket implementation for "Play Next", "Add to Queue", and "Skip Song"
const PLAY_NEXT_STORAGE_KEY = "guest_play_next_bucket";
const ADD_QUEUE_STORAGE_KEY = "guest_add_queue_bucket";
const SKIP_SONG_STORAGE_KEY = "guest_skip_song_bucket";

// Default values (will be overridden by server config)
const PLAY_NEXT_MAX_TOKENS = ref(3); // Maximum tokens for Play Next
const PLAY_NEXT_REFILL_RATE = ref(1000 * 60 * 20); // 20 minutes in milliseconds

// More lenient defaults for general Add to Queue
const ADD_QUEUE_MAX_TOKENS = ref(10); // Maximum tokens for Add to Queue
const ADD_QUEUE_REFILL_RATE = ref(1000 * 60 * 2); // 2 minutes per token

// Skip song - more restrictive by default (1 per hour)
const SKIP_SONG_MAX_TOKENS = ref(1); // Maximum tokens for Skip Song
const SKIP_SONG_REFILL_RATE = ref(1000 * 60 * 60); // 60 minutes per token

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface PartyModeConfig {
  enable_rate_limiting: boolean;
  // Add to Queue feature
  enable_add_queue: boolean;
  add_queue_limit: number;
  add_queue_refill_minutes: number;
  // Play Next feature
  enable_play_next: boolean;
  play_next_limit: number;
  play_next_refill_minutes: number;
  // Skip Song feature
  enable_skip_song: boolean;
  skip_song_limit: number;
  skip_song_refill_minutes: number;
  // UI settings
  album_art_background: boolean;
  // Badge colors
  request_badge_color?: string;
  play_next_badge_color?: string;
}

const rateLimitingEnabled = ref(true); // Default to enabled
// Feature enable toggles (can be disabled by admin)
const addQueueEnabled = ref(true);
const playNextEnabled = ref(true);
const skipSongEnabled = ref(true);
// Badge colors (hex values from config, loaded from party_mode/config)
const requestBadgeColor = ref("");
const playNextBadgeColor = ref("");
// Token counts
const playNextTokens = ref(3);
const addQueueTokens = ref(10);
const skipSongTokens = ref(1);
const playNextAvailable = computed(() => playNextTokens.value > 0);
const skipSongAvailable = computed(() => skipSongTokens.value > 0);
const nextTokenCountdown = ref<string>("");
const skipTokenCountdown = ref<string>("");
const skippingSong = ref(false);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// Generic token bucket functions
const loadTokenBucket = (
  storageKey: string,
  maxTokens: number,
  refillRate: number,
): TokenBucket => {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return {
      tokens: maxTokens,
      lastRefill: Date.now(),
    };
  }

  try {
    const bucket: TokenBucket = JSON.parse(stored);
    const now = Date.now();
    const timeSinceRefill = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timeSinceRefill / refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    return bucket;
  } catch {
    return {
      tokens: maxTokens,
      lastRefill: Date.now(),
    };
  }
};

const saveTokenBucket = (storageKey: string, bucket: TokenBucket) => {
  localStorage.setItem(storageKey, JSON.stringify(bucket));
};

// Generic token consumption function
const consumeToken = (
  storageKey: string,
  maxTokens: number,
  refillRate: number,
  tokenRef: { value: number },
): boolean => {
  const bucket = loadTokenBucket(storageKey, maxTokens, refillRate);
  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens -= 1;
  saveTokenBucket(storageKey, bucket);
  tokenRef.value = bucket.tokens;
  return true;
};

// Generic time until next token function
const getTimeUntilNextTokenRefill = (
  storageKey: string,
  maxTokens: number,
  refillRate: number,
): number => {
  const bucket = loadTokenBucket(storageKey, maxTokens, refillRate);
  if (bucket.tokens >= maxTokens) {
    return 0;
  }

  const timeSinceRefill = Date.now() - bucket.lastRefill;
  const timeUntilNext = refillRate - (timeSinceRefill % refillRate);
  return Math.ceil(timeUntilNext / 1000 / 60); // Return minutes
};

// Convenience wrappers for each token type
const consumePlayNextToken = (): boolean =>
  consumeToken(
    PLAY_NEXT_STORAGE_KEY,
    PLAY_NEXT_MAX_TOKENS.value,
    PLAY_NEXT_REFILL_RATE.value,
    playNextTokens,
  );

const consumeAddQueueToken = (): boolean =>
  consumeToken(
    ADD_QUEUE_STORAGE_KEY,
    ADD_QUEUE_MAX_TOKENS.value,
    ADD_QUEUE_REFILL_RATE.value,
    addQueueTokens,
  );

const consumeSkipSongToken = (): boolean =>
  consumeToken(
    SKIP_SONG_STORAGE_KEY,
    SKIP_SONG_MAX_TOKENS.value,
    SKIP_SONG_REFILL_RATE.value,
    skipSongTokens,
  );

const getTimeUntilNextToken = (): number =>
  getTimeUntilNextTokenRefill(
    PLAY_NEXT_STORAGE_KEY,
    PLAY_NEXT_MAX_TOKENS.value,
    PLAY_NEXT_REFILL_RATE.value,
  );

const getTimeUntilNextAddQueueToken = (): number =>
  getTimeUntilNextTokenRefill(
    ADD_QUEUE_STORAGE_KEY,
    ADD_QUEUE_MAX_TOKENS.value,
    ADD_QUEUE_REFILL_RATE.value,
  );

const getTimeUntilNextSkipToken = (): number =>
  getTimeUntilNextTokenRefill(
    SKIP_SONG_STORAGE_KEY,
    SKIP_SONG_MAX_TOKENS.value,
    SKIP_SONG_REFILL_RATE.value,
  );

// Format countdown timer for next token
const formatCountdown = (milliseconds: number): string => {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
};

// Update countdown display for all token types
const updateCountdown = () => {
  // Update Play Next tokens
  const playNextBucket = loadTokenBucket(
    PLAY_NEXT_STORAGE_KEY,
    PLAY_NEXT_MAX_TOKENS.value,
    PLAY_NEXT_REFILL_RATE.value,
  );
  playNextTokens.value = playNextBucket.tokens;

  if (playNextBucket.tokens >= PLAY_NEXT_MAX_TOKENS.value) {
    nextTokenCountdown.value = "";
  } else {
    const timeSinceRefill = Date.now() - playNextBucket.lastRefill;
    const timeUntilNext =
      PLAY_NEXT_REFILL_RATE.value -
      (timeSinceRefill % PLAY_NEXT_REFILL_RATE.value);
    nextTokenCountdown.value = formatCountdown(timeUntilNext);
  }

  // Update Skip Song tokens
  const skipBucket = loadTokenBucket(
    SKIP_SONG_STORAGE_KEY,
    SKIP_SONG_MAX_TOKENS.value,
    SKIP_SONG_REFILL_RATE.value,
  );
  skipSongTokens.value = skipBucket.tokens;

  if (skipBucket.tokens >= SKIP_SONG_MAX_TOKENS.value) {
    skipTokenCountdown.value = "";
  } else {
    const timeSinceRefill = Date.now() - skipBucket.lastRefill;
    const timeUntilNext =
      SKIP_SONG_REFILL_RATE.value -
      (timeSinceRefill % SKIP_SONG_REFILL_RATE.value);
    skipTokenCountdown.value = formatCountdown(timeUntilNext);
  }
};

// Queue state
const queueItems = ref<QueueItem[]>([]);
const partyModeQueueId = ref<string | null>(null);
const queueListRef = ref<HTMLElement | null>(null);
const queueFetchOffset = ref(0);
const queueTotalItems = ref(0);
const loadingMoreQueueItems = ref(false);

// Simple computed to get current queue and its state directly from the API
const currentQueue = computed(() => {
  const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
  return queueId ? api.queues[queueId] : null;
});

const currentQueueIndex = computed(
  () => currentQueue.value?.current_index ?? 0,
);

// Scroll to the currently playing item
const scrollToCurrentItem = async () => {
  await nextTick();
  if (!queueListRef.value) return;

  const activeItem = queueListRef.value.querySelector(
    ".queue-item-current",
  ) as HTMLElement;
  if (activeItem) {
    // Scroll within the queue container, not the whole page
    const container = queueListRef.value;
    // Calculate position relative to the container
    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const relativeTop = itemRect.top - containerRect.top + container.scrollTop;

    // Center the item in the viewport, accounting for container height
    const containerHeight = containerRect.height;
    const itemHeight = itemRect.height;

    container.scrollTo({ top: relativeTop, behavior: "smooth" });
  }
};

// Auto-scroll to currently playing item when it changes
watch(currentQueueIndex, scrollToCurrentItem);

// Also scroll when queue items are loaded (but not when appending more items)
watch(
  queueItems,
  async (newItems, oldItems) => {
    if (newItems.length > 0) {
      // Only scroll to current item on initial load or reset, not when appending
      // We detect append by checking if new items were added to the end
      const isAppending =
        oldItems &&
        oldItems.length > 0 &&
        newItems.length > oldItems.length &&
        newItems
          .slice(0, oldItems.length)
          .every((item, i) => item.queue_item_id === oldItems[i].queue_item_id);

      if (!isAppending) {
        scrollToCurrentItem();
      }
      runMarqueeScan();
    }
  },
  { deep: true },
);

// Run marquee scan when search results change
watch(
  () => displayedResults.value,
  async () => {
    await nextTick();
    runMarqueeScan();
  },
);

// Snackbar state
const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

// Search functionality
const performSearch = async () => {
  if (!searchQuery.value || searchQuery.value.length < 2) return;

  searching.value = true;
  hasSearched.value = true;
  try {
    const results = await api.search(searchQuery.value, [
      MediaType.TRACK,
      MediaType.ALBUM,
      MediaType.ARTIST,
    ]);
    // Combine all search results into a single array
    searchResults.value = [
      ...results.tracks,
      ...results.albums,
      ...results.artists,
    ];
    // Reset displayed count for new search
    displayedResultsCount.value = 10;
  } catch (error) {
    console.error("Search failed:", error);
    showSnackbar("Search failed. Please try again.", "error");
  } finally {
    searching.value = false;
  }
};

// Debounced search - triggers after user pauses typing
const debouncedSearch = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  // Only trigger if query is long enough
  if (searchQuery.value && searchQuery.value.length >= 2) {
    searchDebounceTimer = setTimeout(() => {
      performSearch();
    }, 400); // 400ms debounce delay
  }
};

// Watch for search query changes and trigger debounced search
watch(searchQuery, (newQuery) => {
  if (!newQuery || newQuery.length < 2) {
    // Clear results if query is too short
    if (hasSearched.value) {
      searchResults.value = [];
      hasSearched.value = false;
    }
  } else {
    debouncedSearch();
  }
});

const clearSearch = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  searchQuery.value = "";
  searchResults.value = [];
  displayedResultsCount.value = 10; // Reset to initial count
  hasSearched.value = false;
};

// Infinite scroll handler
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target) return;

  // Check if we've scrolled near the bottom
  const scrollPosition = target.scrollTop + target.clientHeight;
  const scrollHeight = target.scrollHeight;
  const threshold = 100; // Load more when within 100px of bottom

  if (
    scrollPosition >= scrollHeight - threshold &&
    !loadingMoreResults.value &&
    displayedResultsCount.value < searchResults.value.length
  ) {
    loadMoreResults();
  }
};

// Load more results
const loadMoreResults = () => {
  loadingMoreResults.value = true;

  // Simulate a small delay for smooth UX
  setTimeout(() => {
    const increment = 10;
    const newCount = Math.min(
      displayedResultsCount.value + increment,
      searchResults.value.length,
    );
    displayedResultsCount.value = newCount;
    loadingMoreResults.value = false;
    // runMarqueeScan();
  }, 300);
};

// Add to queue functionality
const addToQueue = async (item: any, position: "next" | "end") => {
  // Check if the feature is enabled
  if (position === "next" && !playNextEnabled.value) {
    showSnackbar("Play Next is disabled by the host.", "warning");
    return;
  }
  if (position === "end" && !addQueueEnabled.value) {
    showSnackbar("Add to Queue is disabled by the host.", "warning");
    return;
  }

  // Only check token limits if rate limiting is enabled
  if (rateLimitingEnabled.value) {
    // Check token bucket rate limit for "Play Next"
    if (position === "next") {
      if (!consumePlayNextToken()) {
        const minutesUntilNext = getTimeUntilNextToken();
        showSnackbar(
          `Play Next limit reached. Next use available in ${minutesUntilNext} minutes.`,
          "warning",
        );
        return;
      }
    } else {
      // Check token bucket rate limit for "Add to Queue"
      if (!consumeAddQueueToken()) {
        const minutesUntilNext = getTimeUntilNextAddQueueToken();
        showSnackbar(
          `Add to Queue limit reached. Next use available in ${minutesUntilNext} minutes.`,
          "warning",
        );
        return;
      }
    }
  }

  const key = `${item.media_type}-${item.item_id}-${position}`;
  addingItems.value.add(key);

  try {
    // Use party mode queue if configured, otherwise use active player queue
    const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
    if (!queueId) {
      throw new Error("No player queue available");
    }

    await api.playMedia(
      item.uri,
      position === "next" ? QueueOption.NEXT : QueueOption.ADD, // option
      undefined, // radio_mode
      undefined, // start_item
      queueId, // queue_id - use configured party mode player
    );

    const action = position === "next" ? "will play next" : "added to queue";
    showSnackbar(`"${item.name}" ${action}`, "success");
  } catch (error) {
    console.error("Failed to add to queue:", error);
    showSnackbar("Failed to add to queue. Please try again.", "error");
  } finally {
    addingItems.value.delete(key);
  }
};

// Queue fetching with smart windowing
const fetchQueueItems = async (reset = true) => {
  const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
  if (!queueId) {
    queueItems.value = [];
    return;
  }

  try {
    // Fetch the queue state first to ensure we have the current index
    // This is important on initial load when api.queues may not be populated yet
    const queue = await api.sendCommand<PlayerQueue>("player_queues/get", {
      queue_id: queueId,
    });
    // Update the reactive queues object so currentQueue computed works
    if (queue) {
      api.queues[queueId] = queue;
      queueTotalItems.value = queue.items || 0;
    }

    if (reset) {
      // Initial load: fetch 50 items starting from current playing position minus 10
      // This ensures the current song is visible with some context before and after
      const currentIdx = queue?.current_index ?? 0;
      const offset = Math.max(0, currentIdx - 10);
      queueFetchOffset.value = offset;

      const items = await api.getPlayerQueueItems(queueId, 50, offset);
      queueItems.value = items;
    } else {
      // Load more items (append to existing)
      loadingMoreQueueItems.value = true;
      const newOffset = queueFetchOffset.value + queueItems.value.length;

      if (newOffset < queueTotalItems.value) {
        const items = await api.getPlayerQueueItems(queueId, 50, newOffset);
        queueItems.value = [...queueItems.value, ...items];
      }

      loadingMoreQueueItems.value = false;
    }
  } catch (error) {
    console.error("Failed to fetch queue items:", error);
    loadingMoreQueueItems.value = false;
  }
};

// Queue scroll handler for infinite scroll
const handleQueueScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target || loadingMoreQueueItems.value) return;

  // Check if scrolled near bottom
  const scrollPosition = target.scrollTop + target.clientHeight;
  const scrollHeight = target.scrollHeight;
  const threshold = 100;

  // Load more if near bottom and there are more items to load
  const hasMore =
    queueFetchOffset.value + queueItems.value.length < queueTotalItems.value;
  if (scrollPosition >= scrollHeight - threshold && hasMore) {
    fetchQueueItems(false);
  }
};

// Marquee helper functions
const applyMarquee = (el: HTMLElement) => {
  const span = el.querySelector("span") as HTMLElement;
  if (!span) return;

  // Reset first to get accurate measurements
  el.classList.remove("marquee");
  span.style.setProperty("--marquee-distance", "0px");

  // Use requestAnimationFrame to ensure layout is complete
  requestAnimationFrame(() => {
    const overflow = span.scrollWidth - el.clientWidth;

    if (overflow <= 2) {
      el.classList.remove("marquee");
      span.style.setProperty("--marquee-distance", "0px");
      return;
    }

    // Set the distance to scroll (the overflow amount + small padding)
    span.style.setProperty("--marquee-distance", `-${overflow + 16}px`);
    // Speed based on distance: ~30px per second
    const duration = Math.max((overflow + 16) / 30, 3);
    span.style.setProperty("--marquee-duration", `${duration}s`);
    el.classList.add("marquee");
  });
};

const runMarqueeScan = () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      document
        .querySelectorAll(".scroll-text")
        .forEach((el) => applyMarquee(el as HTMLElement));
    });
  });
};

const getImageUrl = (item: any) => {
  return getMediaItemImageUrl(item.metadata?.images?.[0] || item.image);
};

const getQueueItemImageUrl = (item: QueueItem) => {
  if (!item.image) return "";
  return getMediaItemImageUrl(item.image);
};

const getArtistName = (item: any) => {
  if (item.media_type === "artist") {
    return "Artist";
  }
  if (item.artists && item.artists.length > 0) {
    return item.artists.map((a: any) => a.name).join(", ");
  }
  if (item.artist) {
    return item.artist.name;
  }
  return "Unknown Artist";
};

const getQueueItemArtist = (item: QueueItem) => {
  // QueueItem has media_item which contains the full track details
  const mediaItem = item.media_item as any;
  if (
    mediaItem?.artists &&
    Array.isArray(mediaItem.artists) &&
    mediaItem.artists.length > 0
  ) {
    return mediaItem.artists.map((a: any) => a.name).join(", ");
  }
  if (mediaItem?.artist?.name) {
    return mediaItem.artist.name;
  }
  return "Unknown Artist";
};

const formatMediaType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const showSnackbar = (message: string, color: string = "success") => {
  snackbar.value = {
    show: true,
    message,
    color,
  };
};

// Skip current song functionality
const skipCurrentSong = async () => {
  // Check if the feature is enabled
  if (!skipSongEnabled.value) {
    showSnackbar("Skip Song is disabled by the host.", "warning");
    return;
  }

  // Check token bucket rate limit if rate limiting is enabled
  if (rateLimitingEnabled.value) {
    if (!consumeSkipSongToken()) {
      const minutesUntilNext = getTimeUntilNextSkipToken();
      showSnackbar(
        `Skip limit reached. Next skip available in ${minutesUntilNext} minutes.`,
        "warning",
      );
      return;
    }
  }

  skippingSong.value = true;
  try {
    // queue_id is the same as player_id in Music Assistant
    const playerId =
      partyModeQueueId.value || store.activePlayerQueue?.queue_id;
    if (!playerId) {
      throw new Error("No player available");
    }

    await api.playerCommandNext(playerId);
    showSnackbar("Song skipped!", "success");
  } catch (error) {
    console.error("Failed to skip song:", error);
    showSnackbar("Failed to skip song. Please try again.", "error");
  } finally {
    skippingSong.value = false;
  }
};

// Exit party mode guest session
const exitGuestMode = () => {
  // Clear auth token to end the session
  localStorage.removeItem("ma_access_token");
  // Redirect to home page (which will trigger normal login flow)
  window.location.href = "/";
};

// Lifecycle
onMounted(async () => {
  // Fetch party mode configuration (token limits and refill rate)
  try {
    const config = (await api.sendCommand(
      "party_mode/config",
    )) as PartyModeConfig;
    if (config) {
      rateLimitingEnabled.value = config.enable_rate_limiting ?? true;
      // Feature enable toggles
      addQueueEnabled.value = config.enable_add_queue ?? true;
      playNextEnabled.value = config.enable_play_next ?? true;
      skipSongEnabled.value = config.enable_skip_song ?? true;
      // Token limits and refill rates
      ADD_QUEUE_MAX_TOKENS.value = config.add_queue_limit || 10;
      ADD_QUEUE_REFILL_RATE.value =
        (config.add_queue_refill_minutes || 2) * 60 * 1000;
      PLAY_NEXT_MAX_TOKENS.value = config.play_next_limit || 3;
      PLAY_NEXT_REFILL_RATE.value =
        (config.play_next_refill_minutes || 20) * 60 * 1000;
      SKIP_SONG_MAX_TOKENS.value = config.skip_song_limit || 1;
      SKIP_SONG_REFILL_RATE.value =
        (config.skip_song_refill_minutes || 60) * 60 * 1000;
      // Badge colors (always set from config)
      requestBadgeColor.value = config.request_badge_color || "#2196F3";
      playNextBadgeColor.value = config.play_next_badge_color || "#FF5722";
    }
  } catch (error) {
    console.error("Failed to fetch party mode config:", error);
    // Use defaults if fetch fails
    requestBadgeColor.value = "#2196F3";
    playNextBadgeColor.value = "#FF5722";
  }

  // Push initial state to enable back interception
  history.pushState(null, "", location.href);
  window.addEventListener("popstate", handleBack);

  // Initialize token buckets (after fetching config)
  const playNextBucket = loadTokenBucket(
    PLAY_NEXT_STORAGE_KEY,
    PLAY_NEXT_MAX_TOKENS.value,
    PLAY_NEXT_REFILL_RATE.value,
  );
  playNextTokens.value = playNextBucket.tokens;

  const addQueueBucket = loadTokenBucket(
    ADD_QUEUE_STORAGE_KEY,
    ADD_QUEUE_MAX_TOKENS.value,
    ADD_QUEUE_REFILL_RATE.value,
  );
  addQueueTokens.value = addQueueBucket.tokens;

  const skipSongBucket = loadTokenBucket(
    SKIP_SONG_STORAGE_KEY,
    SKIP_SONG_MAX_TOKENS.value,
    SKIP_SONG_REFILL_RATE.value,
  );
  skipSongTokens.value = skipSongBucket.tokens;

  // Start countdown timer
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);

  // Fetch party mode player configuration
  try {
    partyModeQueueId.value = await api.sendCommand("party_mode/player");
  } catch (error) {
    console.error("Failed to fetch party mode player:", error);
  }

  // Initial queue fetch
  fetchQueueItems();

  // Subscribe to queue updates - refetch when items change
  const unsub1 = api.subscribe(
    EventType.QUEUE_ITEMS_UPDATED,
    (evt: EventMessage) => {
      const queueId =
        partyModeQueueId.value || store.activePlayerQueue?.queue_id;
      if (evt.object_id === queueId) {
        // When items are added/removed, do a full reset to recalculate offset
        fetchQueueItems(true);
      }
    },
  );

  // Refetch if current playing position moves outside our fetched window
  const unsub2 = api.subscribe(EventType.QUEUE_UPDATED, (evt: EventMessage) => {
    const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
    if (evt.object_id === queueId) {
      const currentIdx = currentQueueIndex.value;
      const fetchedStart = queueFetchOffset.value;
      const fetchedEnd = fetchedStart + queueItems.value.length;

      // Refetch if current song is outside our window or getting close to boundaries
      if (
        currentIdx < fetchedStart + 5 ||
        currentIdx > fetchedEnd - 5 ||
        queueItems.value.length === 0
      ) {
        fetchQueueItems(true);
      }
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener("popstate", handleBack);
    unsub1();
    unsub2();
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
  });
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
  margin-bottom: 2rem;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
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

.play-next-tokens {
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
  margin-bottom: 2rem;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
}

.result-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
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

.queue-position {
  width: 32px;
  text-align: center;
  flex-shrink: 0;
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
    padding: 1rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0));
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .section-title {
    width: 100%;
  }

  .play-next-tokens {
    width: 100%;
    justify-content: center;
  }

  .search-section {
    flex-direction: column;
  }

  .result-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    min-height: auto;
    padding: 1rem;
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
/* ---------- MARQUEE ---------- */

.scroll-text {
  overflow: hidden;
  white-space: nowrap;
}

.scroll-text span {
  display: inline-block;
  white-space: nowrap;
  --marquee-distance: 0px;
  --marquee-duration: 3s;
}

.scroll-text.marquee span {
  animation: marquee var(--marquee-duration) linear infinite;
  animation-delay: 1s;
}

@keyframes marquee {
  0%,
  10% {
    transform: translateX(0);
  }
  45%,
  55% {
    transform: translateX(var(--marquee-distance));
  }
  90%,
  100% {
    transform: translateX(0);
  }
}
</style>
