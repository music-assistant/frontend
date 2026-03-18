<template>
  <div class="party-view" :style="gradientBackgroundStyle">
    <!-- Blurred album art background: separate element so the browser can cache the texture -->
    <div
      v-if="useAlbumArtBackground && albumArtUrl"
      class="background-image"
      :style="{ backgroundImage: `url(${albumArtUrl})` }"
    ></div>
    <!-- Access Error -->
    <div v-if="accessError" class="party-content access-error-content">
      <div class="access-error">
        <Speaker :size="80" class="text-destructive" />
        <h2 class="access-error-title">
          {{ $t("providers.party.no_player_access") }}
        </h2>
        <p class="access-error-message">
          {{ $t("providers.party.no_player_access_detail") }}
        </p>
      </div>
    </div>

    <div
      v-else
      :class="['party-content', { 'party-content--karaoke': karaokeMode }]"
    >
      <!-- Karaoke Mode: QR top-left, lyrics center, track stack bottom -->
      <template v-if="karaokeMode">
        <div
          class="karaoke-qr"
          :style="swapped ? { left: 'auto', right: '2vw' } : undefined"
        >
          <PartyQR />
        </div>

        <div class="karaoke-lyrics">
          <LyricsViewer
            :media-item="store.curQueueItem?.media_item"
            :position="lyricsElapsedTime"
            :stream-details="store.curQueueItem?.streamdetails"
            :lyrics="currentLyrics.plain"
            :lrc-lyrics="currentLyrics.synced"
            :anticipation="10"
            :highlight-ahead="highlightAhead"
          />
        </div>

        <div class="karaoke-track-stack">
          <div
            v-if="!store.curQueueItem && !visibleItems.length"
            class="empty-state empty-state--karaoke"
          >
            <Music :size="60" class="empty-icon" />
            <h2 class="empty-title">
              {{ $t("providers.party.nothing_playing") }}
            </h2>
          </div>
          <TransitionGroup
            v-else
            name="track-slide"
            tag="div"
            class="track-list track-list--karaoke"
          >
            <PartyTrackCard
              v-for="item in visibleItems"
              :key="item.queue_item_id"
              :queue-item="item"
              :position="getPosition(item)"
              :is-playing="isPlaying"
              :request-badge-color="requestBadgeColor"
              :boost-badge-color="boostBadgeColor"
            />
          </TransitionGroup>
        </div>
      </template>

      <!-- Normal Mode -->
      <template v-else>
        <!-- QR Code and Lyrics -->
        <div
          :class="['qr-section', { 'qr-section--with-lyrics': displayLyrics }]"
        >
          <div
            class="qr-wrapper"
            :style="swapped && displayLyrics ? { order: 1 } : undefined"
          >
            <PartyQR />
          </div>
          <div v-if="displayLyrics" class="lyrics-section">
            <LyricsViewer
              :media-item="store.curQueueItem?.media_item"
              :position="lyricsElapsedTime"
              :stream-details="store.curQueueItem?.streamdetails"
              :lyrics="currentLyrics.plain"
              :lrc-lyrics="currentLyrics.synced"
              :highlight-ahead="highlightAhead"
            />
          </div>
        </div>

        <!-- Track Stack or Empty State -->
        <div
          class="track-stack"
          :style="swapped && !displayLyrics ? { order: -1 } : undefined"
        >
          <!-- Empty State -->
          <div
            v-if="!store.curQueueItem && !visibleItems.length"
            class="empty-state"
          >
            <Music :size="120" class="empty-icon" />
            <h2 class="empty-title">
              {{ $t("providers.party.nothing_playing") }}
            </h2>
            <p class="empty-message">
              {{ $t("providers.party.get_started") }}
            </p>
          </div>

          <!-- Track List -->
          <TransitionGroup
            v-else
            name="track-slide"
            tag="div"
            class="track-list"
          >
            <PartyTrackCard
              v-for="item in visibleItems"
              :key="item.queue_item_id"
              :queue-item="item"
              :position="getPosition(item)"
              :is-playing="isPlaying"
              :request-badge-color="requestBadgeColor"
              :boost-badge-color="boostBadgeColor"
            />
          </TransitionGroup>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import LyricsViewer from "@/components/LyricsViewer.vue";
import PartyQR from "@/components/party/PartyQR.vue";
import PartyTrackCard from "@/components/party/PartyTrackCard.vue";
import { usePartyConfig } from "@/composables/usePartyConfig";
import { useLyricsElapsedTime } from "@/composables/useLyricsElapsedTime";
import {
  ImageColorPalette,
  getColorPalette,
  getMediaItemImageUrl,
  parseBool,
} from "@/helpers/utils";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  MediaType,
  PlaybackState,
  QueueItem,
  Track,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import Color from "color";
import { Music, Speaker } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useTheme } from "vuetify";

const theme = useTheme();
const route = useRoute();
const { config: partyConfig, fetchConfig } = usePartyConfig();

const refreshPartyPlayer = async () => {
  const partyPlayerId = await api.sendCommand<string | null>("party/player");
  accessError.value = "";
  if (partyPlayerId) {
    store.activePlayerId = partyPlayerId;
    if (!api.players[partyPlayerId]) {
      accessError.value = "no_access";
    }
  }
};

const albumArtBackgroundEnabled = ref(true); // Default to true
const displayLyrics = ref(false); // Whether karaoke lyrics are shown
const karaokeMode = ref(false); // Whether karaoke mode layout is active
const highlightAhead = ref(true); // Whether lyric highlight finishes at LRC time
const antiBurnIn = ref(false); // Swap QR/track sides periodically
const swapped = ref(false); // Current swap state for anti burn-in
let burnInInterval: ReturnType<typeof setInterval> | null = null;
const accessError = ref("");
// Badge colors (hex values from config)
const requestBadgeColor = ref("");
const boostBadgeColor = ref("");

// Compact mode: hide previous tracks on small screens to reclaim space
const compactQuery = window.matchMedia("(max-width: 768px)");
const isCompact = ref(compactQuery.matches);
const handleCompactChange = (e: MediaQueryListEvent) => {
  isCompact.value = e.matches;
};
compactQuery.addEventListener("change", handleCompactChange);
onBeforeUnmount(() => {
  compactQuery.removeEventListener("change", handleCompactChange);
});

// Check if album art background is enabled - prioritize query parameter over config
const useAlbumArtBackground = computed(() => {
  // Query parameter takes precedence for manual override
  const param = route.query.albumArtBackground;

  if (param !== undefined) {
    const raw = Array.isArray(param) ? param[0] : param;
    return parseBool(raw);
  }
  // Otherwise use config value
  return albumArtBackgroundEnabled.value;
});

const isPlaying = computed(
  () => store.activePlayer?.playback_state === PlaybackState.PLAYING,
);

// Queue items state
const queueItems = ref<QueueItem[]>([]);
const lastFetchedOffset = ref<number>(0);

// Lyrics state
const currentLyrics = ref<{ plain: string | null; synced: string | null }>({
  plain: null,
  synced: null,
});

const fetchLyrics = async () => {
  currentLyrics.value = { plain: null, synced: null };

  const mediaItem = store.curQueueItem?.media_item;
  if (!mediaItem || mediaItem.media_type !== MediaType.TRACK) return;

  const track = mediaItem as Track;
  const existingPlain = track.metadata?.lyrics?.trim() || null;
  const existingSynced = track.metadata?.lrc_lyrics?.trim() || null;

  if (existingPlain || existingSynced) {
    currentLyrics.value = { plain: existingPlain, synced: existingSynced };
    return;
  }

  try {
    const [lyrics, lrcLyrics] = await api.getTrackLyrics(track);
    currentLyrics.value = { plain: lyrics, synced: lrcLyrics };
    if (lyrics || lrcLyrics) {
      track.metadata = {
        ...track.metadata,
        ...(lyrics && { lyrics }),
        ...(lrcLyrics && { lrc_lyrics: lrcLyrics }),
      };
    }
  } catch (error) {
    console.error("Failed to fetch track lyrics:", error);
  }
};

const lyricsEnabled = computed(() => displayLyrics.value || karaokeMode.value);
const { elapsedTime: lyricsElapsedTime, stop: stopTick } =
  useLyricsElapsedTime(lyricsEnabled);

// Color palette state
const colorPalette = ref<ImageColorPalette>({
  "0": "",
  "1": "",
  "2": "",
  "3": "",
  "4": "",
  lightColor: "",
  darkColor: "",
});

// Single list of visible items for the unified TransitionGroup
const visibleItems = computed(() => {
  if (!store.activePlayerQueue) return [];
  const currentIndex = store.activePlayerQueue.current_index || 0;
  const offset = lastFetchedOffset.value;

  // Karaoke mode: current + next only; compact: current + 2 next; normal: 2 prev + current + 2 next
  const isKaraokeCompact = karaokeMode.value && isCompact.value;
  const isKaraoke = karaokeMode.value && !isCompact.value;
  const startDelta = isCompact.value || karaokeMode.value ? 0 : -2;
  const count = isKaraokeCompact ? 1 : isKaraoke ? 2 : isCompact.value ? 3 : 5;
  const items: QueueItem[] = [];

  for (let i = 0; i < count; i++) {
    const queuePosition = currentIndex + startDelta + i;
    const relativeIdx = queuePosition - offset;

    if (relativeIdx >= 0 && relativeIdx < queueItems.value.length) {
      const item = queueItems.value[relativeIdx];
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
});

// Helper to compute position for each item
const getPosition = (item: QueueItem) => {
  if (!store.activePlayerQueue) return "current";
  const currentIndex = store.activePlayerQueue.current_index || 0;
  const offset = lastFetchedOffset.value;

  // Find the queue position of this item
  const relativeIdx = queueItems.value.findIndex(
    (q) => q?.queue_item_id === item.queue_item_id,
  );

  if (relativeIdx === -1) return "current";

  const queuePosition = offset + relativeIdx;
  const delta = queuePosition - currentIndex;

  if (delta === -2) return "previous-2";
  if (delta === -1) return "previous-1";
  if (delta === 0) return "current";
  if (delta === 1) return "next-1";
  if (delta === 2) return "next-2";

  return "current";
};

// Queue data fetching with identity preservation
const fetchQueueItems = async (force = false) => {
  if (!store.activePlayerQueue) {
    queueItems.value = [];
    lastFetchedOffset.value = 0;
    return;
  }

  const currentIndex = store.activePlayerQueue.current_index || 0;
  const offset = Math.max(0, currentIndex - 2);
  // Fetch 6 items: 2 previous + current + 2 next + 1 buffer for smooth transitions
  const limit = 6;

  // Only fetch if we've moved outside our current buffer (unless forced)
  // Check if current position is still within our fetched range
  const isWithinBuffer =
    queueItems.value.length > 0 &&
    currentIndex >= lastFetchedOffset.value &&
    currentIndex < lastFetchedOffset.value + queueItems.value.length - 2;

  if (!force && isWithinBuffer) {
    return;
  }

  try {
    const newItems = await api.getPlayerQueueItems(
      store.activePlayerQueue.queue_id,
      limit,
      offset,
    );

    // Preserve object identity for items that haven't changed
    // This is critical for Vue's transition system to detect moves vs add/remove
    const merged: QueueItem[] = [];
    for (let i = 0; i < newItems.length; i++) {
      const newItem = newItems[i];
      // Find if this item already exists in our current array
      const existing = queueItems.value.find(
        (item) => item?.queue_item_id === newItem?.queue_item_id,
      );
      if (existing) {
        // Merge all new fields into the existing object to keep data fresh
        Object.assign(existing, newItem);
        merged.push(existing);
      } else {
        merged.push(newItem);
      }
    }

    queueItems.value = merged;
    lastFetchedOffset.value = offset;
  } catch (error) {
    console.error("Failed to fetch queue items:", error);
    queueItems.value = [];
    lastFetchedOffset.value = 0;
  }
};

// Dynamic background
const img = new Image();
img.crossOrigin = "Anonymous";
const handleImageLoad = () => {
  colorPalette.value = getColorPalette(img);
};
img.addEventListener("load", handleImageLoad);

onBeforeUnmount(() => {
  img.removeEventListener("load", handleImageLoad);
  img.src = "";
});

watch(
  () => store.curQueueItem?.image,
  (image) => {
    if (image) {
      const imageUrl = getMediaItemImageUrl(image);
      if (imageUrl) {
        img.src = imageUrl;
      }
    } else {
      // Fallback to default colors
      colorPalette.value = {
        "0": "",
        "1": "",
        "2": "",
        "3": "",
        "4": "",
        lightColor: theme.current.value.dark ? "#1a1a1a" : "#f5f5f5",
        darkColor: theme.current.value.dark ? "#0a0a0a" : "#e0e0e0",
      };
    }
  },
  { immediate: true },
);

// Album art URL for the blurred background element
const albumArtUrl = computed(() => {
  if (!store.curQueueItem?.image) return "";
  return getMediaItemImageUrl(store.curQueueItem.image) || "";
});

// Gradient background style (used when album art is disabled, or as fallback)
const gradientBackgroundStyle = computed(() => {
  // When using album art, the .background-image element handles visuals
  if (useAlbumArtBackground.value && albumArtUrl.value) {
    return {};
  }

  const LIGHT_TEXT_COLOR = Color("white");
  const DARK_TEXT_COLOR = Color("black");
  const MIN_CONTRAST = 5;
  const ADJUSTMENT_INCREMENT = 0.05;

  const coverImageColorCode = theme.current.value.dark
    ? colorPalette.value.darkColor || "#1a1a1a"
    : colorPalette.value.lightColor || "#f5f5f5";

  let bgColor = Color(coverImageColorCode);

  const lightContrast = LIGHT_TEXT_COLOR.contrast(bgColor);
  const darkContrast = DARK_TEXT_COLOR.contrast(bgColor);

  const isLight = lightContrast >= darkContrast;
  let contrast = Math.max(lightContrast, darkContrast);

  if (contrast < MIN_CONTRAST) {
    let adjustment = ADJUSTMENT_INCREMENT;

    while (contrast < MIN_CONTRAST && adjustment <= 0.5) {
      if (isLight) {
        bgColor = bgColor.darken(ADJUSTMENT_INCREMENT);
      } else {
        bgColor = bgColor.lighten(ADJUSTMENT_INCREMENT);
      }

      contrast = isLight
        ? LIGHT_TEXT_COLOR.contrast(bgColor)
        : DARK_TEXT_COLOR.contrast(bgColor);
      adjustment += ADJUSTMENT_INCREMENT;
    }
  }

  return {
    background: `linear-gradient(135deg, ${bgColor.hex()} 0%, ${bgColor.darken(0.2).hex()} 100%)`,
    transition: "background 0.8s ease-in-out",
  };
});

// Screen Wake Lock to prevent display from sleeping
let wakeLock: WakeLockSentinel | null = null;

const requestWakeLock = async () => {
  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        console.debug("Wake lock released");
        wakeLock = null;
        // Re-acquire wake lock if document is still visible
        // This handles cases where the system releases it unexpectedly
        if (document.visibilityState === "visible") {
          requestWakeLock();
        }
      });
      console.debug("Wake lock acquired");
    } catch (err) {
      console.debug("Wake lock request failed:", err);
    }
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState === "visible" && !wakeLock) {
    // Re-acquire wake lock when page becomes visible again
    requestWakeLock();
  }
};

// Lifecycle and event subscriptions
// Apply layout overrides to the parent .content-section so the party view
// fills its container. Scoped to mount/unmount to avoid leaking global styles.
const parentSection = ref<HTMLElement | null>(null);

const applyParentStyles = () => {
  const el = document.querySelector(".content-section");
  if (el instanceof HTMLElement) {
    parentSection.value = el;
    el.classList.add("party-view-active");
  }
};

const cleanupParentStyles = () => {
  if (parentSection.value) {
    parentSection.value.classList.remove("party-view-active");
    parentSection.value = null;
  }
};

const BURN_IN_SWAP_MS = 10 * 60 * 1000; // 10 minutes

watch(antiBurnIn, (enabled) => {
  if (burnInInterval) {
    clearInterval(burnInInterval);
    burnInInterval = null;
  }
  if (enabled) {
    swapped.value = false;
    burnInInterval = setInterval(() => {
      swapped.value = !swapped.value;
    }, BURN_IN_SWAP_MS);
  } else {
    swapped.value = false;
  }
});

onMounted(async () => {
  // Apply parent container overrides
  applyParentStyles();

  // Request wake lock to keep screen on
  await requestWakeLock();
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Set active player from party config (needed when opened in a new tab
  // where the Default layout's player selection logic doesn't run)
  await refreshPartyPlayer();

  // Fetch party configuration via shared composable
  const config = await fetchConfig();
  if (config) {
    if (config.album_art_background !== undefined) {
      albumArtBackgroundEnabled.value = config.album_art_background;
    }
    if (config.display_lyrics !== undefined) {
      displayLyrics.value = config.display_lyrics;
    }
    if (config.karaoke_mode !== undefined) {
      karaokeMode.value = config.display_lyrics && config.karaoke_mode;
    }
    if (config.highlight_ahead !== undefined) {
      highlightAhead.value = config.highlight_ahead;
    }
    requestBadgeColor.value = config.request_badge_color ?? "#2196F3";
    boostBadgeColor.value = config.boost_badge_color ?? "#FF5722";
    antiBurnIn.value = config.anti_burn_in ?? false;
  } else {
    requestBadgeColor.value = "#2196F3";
    boostBadgeColor.value = "#FF5722";
  }

  // Initial fetch
  fetchQueueItems();

  // Subscribe to queue item updates
  const unsub1 = api.subscribe(
    EventType.QUEUE_ITEMS_UPDATED,
    (evt: EventMessage) => {
      if (evt.object_id !== store.activePlayerQueue?.queue_id) return;
      // Force refetch when items are added/removed (e.g., Play Next)
      // This ensures the view updates even if we're "within buffer"
      fetchQueueItems(true);
    },
  );
  onBeforeUnmount(unsub1);

  // Subscribe to queue updates (for index changes)
  const unsub2 = api.subscribe(EventType.QUEUE_UPDATED, (evt: EventMessage) => {
    if (evt.object_id !== store.activePlayerQueue?.queue_id) return;
    // Don't force refetch for index changes - let buffer optimization work
    fetchQueueItems();
  });
  onBeforeUnmount(unsub2);

  // Subscribe to provider updates to detect party player config changes
  const unsub3 = api.subscribe(EventType.PROVIDERS_UPDATED, async () => {
    await refreshPartyPlayer();
    fetchQueueItems(true);
  });
  onBeforeUnmount(unsub3);
});

// Cleanup when leaving the party view
onBeforeUnmount(() => {
  // Release wake lock
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
  if (burnInInterval) {
    clearInterval(burnInInterval);
    burnInInterval = null;
  }
  stopTick();
  cleanupParentStyles();
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});

// React to party config changes (e.g., admin toggles player controls)
watch(partyConfig, (newConfig) => {
  if (newConfig) {
    albumArtBackgroundEnabled.value = newConfig.album_art_background ?? true;
    displayLyrics.value = newConfig.display_lyrics ?? false;
    karaokeMode.value =
      (newConfig.display_lyrics ?? false) && (newConfig.karaoke_mode ?? false);
    highlightAhead.value = newConfig.highlight_ahead ?? true;
    requestBadgeColor.value = newConfig.request_badge_color ?? "#2196F3";
    boostBadgeColor.value = newConfig.boost_badge_color ?? "#FF5722";
    antiBurnIn.value = newConfig.anti_burn_in ?? false;
  } else {
    albumArtBackgroundEnabled.value = true;
    displayLyrics.value = false;
    karaokeMode.value = false;
    highlightAhead.value = true;
    requestBadgeColor.value = "#2196F3";
    boostBadgeColor.value = "#FF5722";
    antiBurnIn.value = false;
  }
});

// Watch for active player queue changes
watch(
  () => store.activePlayerQueue?.queue_id,
  () => {
    fetchQueueItems();
  },
);

// Fetch lyrics when track changes, and pre-fetch next track lyrics
watch(
  () => store.curQueueItem?.media_item?.item_id,
  async () => {
    await fetchLyrics();
    // Pre-fetch next track lyrics so they're cached when it starts playing
    const nextItem = store.activePlayerQueue?.next_item;
    if (nextItem?.media_item?.media_type === MediaType.TRACK) {
      api.getTrackLyrics(nextItem.media_item as Track).catch(() => {});
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.party-view {
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.background-image {
  position: absolute;
  top: -5%;
  left: -5%;
  width: 110%;
  height: 110%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: blur(2vw) brightness(0.5);
  z-index: 0;
  transition: background-image 0.8s ease-in-out;
}

.party-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  padding: 2vw;
  gap: 2vw;
  overflow: hidden;
  box-sizing: border-box;
}

.qr-section {
  flex: 0 0 42vw;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  height: 60vh;
}

.qr-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-section--with-lyrics {
  flex-direction: column;
  height: 100%;
  align-self: stretch;
}

.qr-section--with-lyrics .qr-wrapper {
  flex: 0 0 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 50%;
}

.lyrics-section {
  flex: 0 0 50%;
  overflow: hidden;
  max-height: 50%;
}

.lyrics-section :deep(.synced-content) {
  padding: 15vh 0;
}

.track-stack {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 0;
}

.track-list {
  position: relative;
  width: 100%;
  height: 80%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Empty State - same dimensions as .track-list for consistent layout */
.empty-state {
  position: relative;
  width: 100%;
  height: 80%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem;
  box-sizing: border-box;
  overflow: hidden;
  animation: fadeIn 0.6s ease-in-out;
}

.empty-icon {
  opacity: 0.5;
  margin-bottom: 1.5rem;
}

.empty-title {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

.empty-message {
  font-size: 1.25rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  max-width: 500px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==================== Karaoke Mode Layout ==================== */
.party-content--karaoke {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.karaoke-qr {
  position: absolute;
  top: 2vw;
  left: 2vw;
  z-index: 1;
  max-width: 20vw;
}

.karaoke-qr :deep(.qr-display) {
  padding: clamp(0.5rem, 1vw, 1.5rem);
}

.karaoke-lyrics {
  flex: 1;
  width: 100%;
  max-width: 70vw;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
  position: relative;
  z-index: 2;
}

.karaoke-lyrics :deep(.synced-content) {
  padding: 20vh 0;
}

.karaoke-lyrics :deep(.lyrics-line) {
  font-size: clamp(2rem, 4vw, 4rem);
}

.karaoke-track-stack {
  flex: 0 0 auto;
  width: 100%;
  max-width: 60vw;
  display: flex;
  justify-content: center;
  padding-bottom: 1rem;
}

.karaoke-track-stack :deep(.track-artwork) {
  width: 10vh;
  height: 10vh;
}

.track-list--karaoke {
  flex-direction: column;
  gap: 0;
  height: auto;
  width: 100%;
  justify-content: center;
  align-items: center;
}

.empty-state--karaoke {
  height: auto;
  padding: 1rem;
}

/* Transition animations */
.track-slide-move {
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-slide-enter-active,
.track-slide-leave-active {
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-slide-leave-active {
  position: absolute;
  width: 95%;
}

.track-slide-enter-from,
.track-slide-leave-to {
  opacity: 0;
}

/* Access error state */
.access-error-content {
  justify-content: center;
}

.access-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  padding: 2rem;
}

.access-error-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.9);
}

.access-error-message {
  font-size: 1rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  max-width: 400px;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  /* Karaoke */
  .karaoke-qr {
    max-width: 25vw;
  }

  .karaoke-lyrics {
    max-width: 85vw;
  }

  .karaoke-track-stack {
    max-width: 80vw;
  }

  /* General layout */
  .party-content {
    flex-direction: column;
    justify-content: center;
    padding: 1rem;
    gap: 1rem;
  }

  .qr-section {
    flex: 0 1 auto;
    height: auto;
    align-self: auto;
    overflow: hidden;
  }

  .qr-section--with-lyrics {
    flex-direction: row;
    flex: 1 1 0;
    min-height: 0;
    gap: 1rem;
  }

  .qr-section--with-lyrics .qr-wrapper {
    flex: 1 1 50%;
    min-height: 0;
  }

  .qr-section--with-lyrics .lyrics-section {
    flex: 1 1 50%;
    min-height: 0;
    overflow: hidden;
  }

  .track-stack {
    flex: 0 0 auto;
    min-height: 0;
    overflow: hidden;
  }

  .track-list {
    height: 100%;
  }

  .empty-state {
    height: 100%;
  }

  .qr-box {
    width: 12vh;
    height: 12vh;
  }

  .qr-icon {
    font-size: 40px !important;
  }

  .qr-text {
    font-size: 0.875rem;
  }

  .qr-subtext {
    font-size: 0.75rem;
  }

  .empty-icon {
    font-size: 80px !important;
  }

  .empty-title {
    font-size: 1.5rem;
  }

  .empty-message {
    font-size: 1rem;
  }
}

@media (max-width: 768px) {
  .karaoke-qr {
    display: none;
  }

  .karaoke-lyrics {
    max-width: 100%;
  }

  .karaoke-lyrics :deep(.synced-content) {
    padding: 10vh 0;
  }

  .karaoke-track-stack {
    max-width: 100%;
  }

  .party-content {
    justify-content: stretch;
    padding: 0.5rem;
    gap: 0.25rem;
  }

  .qr-section {
    flex: 1 1 0;
    max-height: none;
  }

  .qr-section--with-lyrics {
    flex-direction: column;
    height: auto;
    align-self: auto;
  }

  .qr-section--with-lyrics .qr-wrapper {
    flex: 1 1 auto;
    max-height: none;
  }

  .lyrics-section {
    display: none;
  }

  .track-stack {
    flex: 0 1 auto;
  }

  .empty-icon {
    font-size: 60px !important;
  }

  .empty-title {
    font-size: 1.25rem;
  }

  .empty-message {
    font-size: 0.875rem;
  }
}
</style>

<style>
/* Classes toggled programmatically on .content-section by mount/unmount */
.content-section.party-view-active {
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
}
</style>
