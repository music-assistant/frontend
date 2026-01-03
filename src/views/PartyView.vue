<template>
  <div class="party-view" :style="backgroundStyle">
    <!-- Dark overlay when using album art background for better text readability -->
    <div v-if="useAlbumArtBackground" class="background-overlay"></div>
    <div class="party-content">
      <!-- QR Code -->
      <div class="qr-section">
        <PartyModeQR />
      </div>

      <!-- Track Stack -->
      <div class="track-stack">
        <TransitionGroup name="track-slide" tag="div" class="track-list">
          <PartyTrackCard
            v-for="item in visibleItems"
            :key="item.queue_item_id"
            :queue-item="item"
            :position="getPosition(item)"
          />
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useTheme } from "vuetify";
import { useRoute } from "vue-router";
import Color from "color";
import PartyTrackCard from "@/components/PartyTrackCard.vue";
import PartyModeQR from "@/components/PartyModeQR.vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { EventType, EventMessage, QueueItem } from "@/plugins/api/interfaces";
import {
  ImageColorPalette,
  getColorPalette,
  getMediaItemImageUrl,
} from "@/helpers/utils";

const theme = useTheme();
const route = useRoute();

// Party mode configuration
interface PartyModeConfig {
  play_next_limit: number;
  play_next_refill_minutes: number;
  add_queue_limit: number;
  add_queue_refill_minutes: number;
  album_art_background: boolean;
}

const albumArtBackgroundEnabled = ref(true); // Default to true

// Check if album art background is enabled - prioritize query parameter over config
const useAlbumArtBackground = computed(() => {
  // Query parameter takes precedence for manual override
  if (route.query.albumArtBackground !== undefined) {
    return !!route.query.albumArtBackground;
  }
  // Otherwise use config value
  return albumArtBackgroundEnabled.value;
});

// Queue items state
const queueItems = ref<QueueItem[]>([]);
const lastFetchedOffset = ref<number>(0);

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

  // Return up to 5 items: previous-2, previous-1, current, next-1, next-2
  const items: QueueItem[] = [];

  for (let i = 0; i < 5; i++) {
    const queuePosition = currentIndex - 2 + i;
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
      // If it exists, reuse the exact same object reference
      merged.push(existing || newItem);
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
img.addEventListener("load", function () {
  colorPalette.value = getColorPalette(img);
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

const backgroundStyle = computed(() => {
  // If album art background is enabled, use the image directly
  if (useAlbumArtBackground.value && store.curQueueItem?.image) {
    const imageUrl = getMediaItemImageUrl(store.curQueueItem.image);
    if (imageUrl) {
      return {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        transition: "background 0.8s ease-in-out",
        position: "relative" as const,
      };
    }
  }

  // Otherwise use color gradient (default behavior)
  const LIGHT_TEXT_COLOR = Color("white");
  const DARK_TEXT_COLOR = Color("black");
  const MIN_CONTRAST = 5;
  const ADJUSTMENT_INCREMENT = 0.05;

  // Determine the base color from palette or fallback to theme default
  const coverImageColorCode = theme.current.value.dark
    ? colorPalette.value.darkColor || "#1a1a1a"
    : colorPalette.value.lightColor || "#f5f5f5";

  // Start with the original cover color as background
  let bgColor = Color(coverImageColorCode);

  // Calculate contrast with white and black
  const lightContrast = LIGHT_TEXT_COLOR.contrast(bgColor);
  const darkContrast = DARK_TEXT_COLOR.contrast(bgColor);

  // Choose the color with higher contrast as starting value
  const isLight = lightContrast >= darkContrast;
  let contrast = Math.max(lightContrast, darkContrast);

  // If the best contrast still doesn't meet requirements, adjust background
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

  // Apply gradient for visual interest
  return {
    background: `linear-gradient(135deg, ${bgColor.hex()} 0%, ${bgColor.darken(0.2).hex()} 100%)`,
    transition: "background 0.8s ease-in-out",
  };
});

// Lifecycle and event subscriptions
onMounted(async () => {
  // Fetch party mode configuration (for album art background setting)
  try {
    const config = (await api.sendCommand(
      "webserver/party_mode_config",
    )) as PartyModeConfig;
    if (config && config.album_art_background !== undefined) {
      albumArtBackgroundEnabled.value = config.album_art_background;
    }
  } catch (error) {
    console.error("Failed to fetch party mode config:", error);
    // Use default (true) if fetch fails
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

  // Subscribe to queue updates (for index changes)
  const unsub2 = api.subscribe(EventType.QUEUE_UPDATED, (evt: EventMessage) => {
    if (evt.object_id !== store.activePlayerQueue?.queue_id) return;
    // Don't force refetch for index changes - let buffer optimization work
    fetchQueueItems();
  });

  onBeforeUnmount(() => {
    unsub1();
    unsub2();
  });
});

// Watch for active player queue changes
watch(
  () => store.activePlayerQueue?.queue_id,
  () => {
    fetchQueueItems();
  },
);
</script>

<style scoped>
.party-view {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  z-index: 0;
}

.party-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  padding: 2rem;
  gap: 2rem;
}

.qr-section {
  flex: 0 0 300px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  height: 800px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Transition animations */
.track-slide-enter-active,
.track-slide-leave-active {
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-slide-enter-from,
.track-slide-leave-to {
  opacity: 0;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .party-content {
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
  }

  .qr-section {
    flex: 0 0 120px;
  }

  .track-list {
    height: 600px;
  }

  .qr-box {
    width: 120px;
    height: 120px;
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
}

@media (max-width: 768px) {
  .qr-section {
    display: none;
  }

  .party-content {
    padding: 0.5rem;
  }

  .track-list {
    height: 500px;
  }
}
</style>
