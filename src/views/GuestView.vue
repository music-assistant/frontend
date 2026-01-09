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
              color="primary"
              variant="elevated"
              :loading="
                addingItems.has(`${item.media_type}-${item.item_id}-end`)
              "
              class="action-btn action-btn-primary"
              @click="addToQueue(item, 'end')"
            >
              <v-icon start>mdi-playlist-plus</v-icon>
              Add
            </v-btn>
            <v-btn
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

    <!-- Empty State -->
    <div v-else-if="!searching && searchQuery" class="empty-state">
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
            'queue-item-current': item.sort_index === currentQueueIndex,
          }"
        >
          <div class="queue-position">
            <v-icon
              v-if="item.sort_index === currentQueueIndex"
              color="primary"
            >
              mdi-play-circle
            </v-icon>
            <span v-else class="queue-number">{{ index + 1 }}</span>
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

// Infinite scroll state
const resultsListRef = ref<HTMLElement | null>(null);
const displayedResultsCount = ref(10); // Start with 10 results
const loadingMoreResults = ref(false);
const displayedResults = computed(() =>
  searchResults.value.slice(0, displayedResultsCount.value),
);

// Rate limiting - Token bucket implementation for both "Play Next" and "Add to Queue"
const PLAY_NEXT_STORAGE_KEY = "guest_play_next_bucket";
const ADD_QUEUE_STORAGE_KEY = "guest_add_queue_bucket";

// Default values (will be overridden by server config)
const PLAY_NEXT_MAX_TOKENS = ref(3); // Maximum tokens for Play Next
const PLAY_NEXT_REFILL_RATE = ref(1000 * 60 * 20); // 20 minutes in milliseconds

// More lenient defaults for general Add to Queue
const ADD_QUEUE_MAX_TOKENS = ref(10); // Maximum tokens for Add to Queue
const ADD_QUEUE_REFILL_RATE = ref(1000 * 60 * 2); // 2 minutes per token

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface PartyModeConfig {
  enable_rate_limiting: boolean;
  play_next_limit: number;
  play_next_refill_minutes: number;
  add_queue_limit: number;
  add_queue_refill_minutes: number;
  album_art_background: boolean;
}

const rateLimitingEnabled = ref(true); // Default to enabled
const playNextTokens = ref(3);
const addQueueTokens = ref(10);
const playNextAvailable = computed(() => playNextTokens.value > 0);
const nextTokenCountdown = ref<string>("");
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

const consumePlayNextToken = (): boolean => {
  const bucket = loadTokenBucket(
    PLAY_NEXT_STORAGE_KEY,
    PLAY_NEXT_MAX_TOKENS.value,
    PLAY_NEXT_REFILL_RATE.value,
  );
  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens -= 1;
  saveTokenBucket(PLAY_NEXT_STORAGE_KEY, bucket);
  playNextTokens.value = bucket.tokens;
  return true;
};

const consumeAddQueueToken = (): boolean => {
  const bucket = loadTokenBucket(
    ADD_QUEUE_STORAGE_KEY,
    ADD_QUEUE_MAX_TOKENS.value,
    ADD_QUEUE_REFILL_RATE.value,
  );
  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens -= 1;
  saveTokenBucket(ADD_QUEUE_STORAGE_KEY, bucket);
  addQueueTokens.value = bucket.tokens;
  return true;
};

const getTimeUntilNextToken = (): number => {
  const bucket = loadTokenBucket(
    PLAY_NEXT_STORAGE_KEY,
    PLAY_NEXT_MAX_TOKENS.value,
    PLAY_NEXT_REFILL_RATE.value,
  );
  if (bucket.tokens >= PLAY_NEXT_MAX_TOKENS.value) {
    return 0;
  }

  const timeSinceRefill = Date.now() - bucket.lastRefill;
  const timeUntilNext =
    PLAY_NEXT_REFILL_RATE.value -
    (timeSinceRefill % PLAY_NEXT_REFILL_RATE.value);
  return Math.ceil(timeUntilNext / 1000 / 60); // Return minutes
};

const getTimeUntilNextAddQueueToken = (): number => {
  const bucket = loadTokenBucket(
    ADD_QUEUE_STORAGE_KEY,
    ADD_QUEUE_MAX_TOKENS.value,
    ADD_QUEUE_REFILL_RATE.value,
  );
  if (bucket.tokens >= ADD_QUEUE_MAX_TOKENS.value) {
    return 0;
  }

  const timeSinceRefill = Date.now() - bucket.lastRefill;
  const timeUntilNext =
    ADD_QUEUE_REFILL_RATE.value -
    (timeSinceRefill % ADD_QUEUE_REFILL_RATE.value);
  return Math.ceil(timeUntilNext / 1000 / 60); // Return minutes
};

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

// Update countdown display
const updateCountdown = () => {
  const bucket = loadTokenBucket(
    PLAY_NEXT_STORAGE_KEY,
    PLAY_NEXT_MAX_TOKENS.value,
    PLAY_NEXT_REFILL_RATE.value,
  );

  // Always update the token count display
  playNextTokens.value = bucket.tokens;

  if (bucket.tokens >= PLAY_NEXT_MAX_TOKENS.value) {
    nextTokenCountdown.value = "";
    return;
  }

  const timeSinceRefill = Date.now() - bucket.lastRefill;
  const timeUntilNext =
    PLAY_NEXT_REFILL_RATE.value -
    (timeSinceRefill % PLAY_NEXT_REFILL_RATE.value);

  nextTokenCountdown.value = formatCountdown(timeUntilNext);
};

// Queue state
const queueItems = ref<QueueItem[]>([]);
const partyModeQueueId = ref<string | null>(null);
const queueListRef = ref<HTMLElement | null>(null);
const queueFetchOffset = ref(0);
const queueTotalItems = ref(0);
const loadingMoreQueueItems = ref(false);

const currentQueueIndex = computed(() => {
  // Use party mode queue if configured, otherwise use active player queue
  const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
  if (queueId && api.queues[queueId]) {
    return api.queues[queueId].current_index ?? 0;
  }
  return 0;
});

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

// Also scroll when queue items are loaded
watch(
  queueItems,
  async (newItems) => {
    if (newItems.length > 0) {
      scrollToCurrentItem();
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

const clearSearch = () => {
  searchQuery.value = "";
  searchResults.value = [];
  displayedResultsCount.value = 10; // Reset to initial count
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
  // Use party mode queue if configured, otherwise use active player queue
  const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
  if (!queueId) {
    queueItems.value = [];
    return;
  }

  try {
    // Get total queue size from api.queues
    const queue = api.queues[queueId];
    queueTotalItems.value = queue?.items || 0;

    if (reset) {
      // Initial load: fetch 50 items starting from current playing position minus 10
      // This ensures the current song is visible with some context before and after
      const currentIdx = currentQueueIndex.value;
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

// Exit guest mode
const exitGuestMode = () => {
  // Clear guest mode flag
  localStorage.removeItem("guest_mode");
  // Clear auth token
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
      PLAY_NEXT_MAX_TOKENS.value = config.play_next_limit || 3;
      PLAY_NEXT_REFILL_RATE.value =
        (config.play_next_refill_minutes || 20) * 60 * 1000;
      ADD_QUEUE_MAX_TOKENS.value = config.add_queue_limit || 10;
      ADD_QUEUE_REFILL_RATE.value =
        (config.add_queue_refill_minutes || 2) * 60 * 1000;
    }
  } catch (error) {
    console.error("Failed to fetch party mode config:", error);
    // Use defaults if fetch fails
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

  // Subscribe to queue updates
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

  const unsub2 = api.subscribe(EventType.QUEUE_UPDATED, (evt: EventMessage) => {
    const queueId = partyModeQueueId.value || store.activePlayerQueue?.queue_id;
    if (evt.object_id === queueId) {
      // Check if current index has moved outside our fetched range
      const currentIdx = currentQueueIndex.value;
      const fetchedStart = queueFetchOffset.value;
      const fetchedEnd = queueFetchOffset.value + queueItems.value.length;

      // Only reset if current index is outside our fetched range
      // or if we're getting close to the boundaries (within 5 items)
      if (
        currentIdx < fetchedStart + 5 ||
        currentIdx > fetchedEnd - 5 ||
        queueItems.value.length === 0
      ) {
        fetchQueueItems(true);
      }
      // Otherwise, just let the watchers handle scrolling to the current item
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener("popstate", handleBack);
    unsub1();
    unsub2();
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
  });
});
</script>

<style scoped>
.guest-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
  min-height: 100vh;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  padding: 1.5rem;
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
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  flex-shrink: 0;
}

.queue-section .section-title {
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.2);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
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

.empty-queue {
  text-align: center;
  padding: 2rem;
  opacity: 0.5;
}

@media (max-width: 768px) {
  .guest-view {
    padding: 1rem;
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
