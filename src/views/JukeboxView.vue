<template>
  <div class="jukebox-view" :style="backgroundStyle">
    <JukeboxScreensaver
      v-if="shouldShowScreensaver"
      :message="screensaverMessage"
      @wake="resetIdleTimer"
    />

    <div v-else class="jukebox-content">
      <!-- QR Code Placeholder -->
      <div class="qr-section">
        <div class="qr-placeholder">
          <div class="qr-box">
            <v-icon size="64" icon="mdi-qrcode" class="qr-icon" />
            <p class="qr-text">Join the Party</p>
            <p class="qr-subtext">QR Code</p>
          </div>
        </div>
      </div>

      <!-- Track Stack -->
      <div class="track-stack">
        <!-- Previous tracks (top) -->
        <div class="track-section previous">
          <TransitionGroup name="track-slide">
            <JukeboxTrackCard
              v-for="(item, idx) in previousTwo"
              :key="item?.queue_item_id || `prev-${idx}`"
              :queue-item="item"
              :position="idx === 0 ? 'previous-2' : 'previous-1'"
            />
          </TransitionGroup>
        </div>

        <!-- Current track (center, large) -->
        <div class="track-section current">
          <TransitionGroup name="track-slide">
            <JukeboxTrackCard
              v-if="current"
              :key="current.queue_item_id"
              :queue-item="current"
              position="current"
            />
          </TransitionGroup>
        </div>

        <!-- Next tracks (bottom) -->
        <div class="track-section next">
          <TransitionGroup name="track-slide">
            <JukeboxTrackCard
              v-for="(item, idx) in nextTwo"
              :key="item?.queue_item_id || `next-${idx}`"
              :queue-item="item"
              :position="idx === 0 ? 'next-1' : 'next-2'"
            />
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useTheme } from "vuetify";
import Color from "color";
import JukeboxScreensaver from "@/components/JukeboxScreensaver.vue";
import JukeboxTrackCard from "@/components/JukeboxTrackCard.vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  EventType,
  EventMessage,
  QueueItem,
  PlaybackState,
} from "@/plugins/api/interfaces";
import {
  ImageColorPalette,
  getColorPalette,
  getMediaItemImageUrl,
} from "@/helpers/utils";
import { getSourceName } from "@/plugins/api/helpers";

const theme = useTheme();

// Queue items state
const queueItems = ref<QueueItem[]>([]);

// Screensaver state
const IDLE_TIMEOUT = 120000; // 2 minutes
const showIdleScreensaver = ref(false);
let idleTimer: ReturnType<typeof setTimeout> | null = null;

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

// Computed properties for queue item display
const previousTwo = computed(() => {
  if (!store.activePlayerQueue) return [];
  const currentIndex = store.activePlayerQueue.current_index || 0;
  const items: (QueueItem | undefined)[] = [];

  if (currentIndex >= 2) {
    items.push(queueItems.value[currentIndex - 2]);
  }
  if (currentIndex >= 1) {
    items.push(queueItems.value[currentIndex - 1]);
  }

  return items.filter((item) => item !== undefined) as QueueItem[];
});

const current = computed(() => {
  if (!store.activePlayerQueue) return undefined;
  const currentIndex = store.activePlayerQueue.current_index || 0;
  return queueItems.value[currentIndex];
});

const nextTwo = computed(() => {
  if (!store.activePlayerQueue) return [];
  const currentIndex = store.activePlayerQueue.current_index || 0;
  const items: (QueueItem | undefined)[] = [];

  if (queueItems.value[currentIndex + 1]) {
    items.push(queueItems.value[currentIndex + 1]);
  }
  if (queueItems.value[currentIndex + 2]) {
    items.push(queueItems.value[currentIndex + 2]);
  }

  return items.filter((item) => item !== undefined) as QueueItem[];
});

// Screensaver logic
const screensaverMessage = computed(() => {
  if (!store.activePlayer) {
    return "No player selected";
  }
  if (store.activePlayer.powered === false) {
    return "Player is off";
  }
  if (store.activePlayer.active_source && !store.activePlayerQueue) {
    return `External source active: ${getSourceName(store.activePlayer)}`;
  }
  if (!store.activePlayerQueue || store.activePlayerQueue.items === 0) {
    return "Queue is empty";
  }
  if (showIdleScreensaver.value) {
    return "Idle";
  }
  return "Queue is empty";
});

const shouldShowScreensaver = computed(() => {
  // Don't show screensaver if music is playing
  const isPlaying = store.activePlayer?.playback_state === PlaybackState.PLAYING;

  // Show screensaver only if:
  // - No active player, OR
  // - Player is powered off, OR
  // - Queue is empty, OR
  // - External source is active, OR
  // - Idle timeout AND not currently playing
  return (
    !store.activePlayer ||
    store.activePlayer.powered === false ||
    !store.activePlayerQueue ||
    store.activePlayerQueue.items === 0 ||
    (store.activePlayer.active_source && !store.activePlayerQueue) ||
    (showIdleScreensaver.value && !isPlaying)
  );
});

// Idle detection
const resetIdleTimer = () => {
  if (idleTimer) clearTimeout(idleTimer);
  showIdleScreensaver.value = false;

  idleTimer = setTimeout(() => {
    showIdleScreensaver.value = true;
  }, IDLE_TIMEOUT);
};

// Queue data fetching
const fetchQueueItems = async () => {
  if (!store.activePlayerQueue) {
    queueItems.value = [];
    return;
  }

  const currentIndex = store.activePlayerQueue.current_index || 0;
  const offset = Math.max(0, currentIndex - 2);
  const limit = 5;

  try {
    const items = await api.getPlayerQueueItems(
      store.activePlayerQueue.queue_id,
      limit,
      offset,
    );
    queueItems.value = items;
  } catch (error) {
    console.error("Failed to fetch queue items:", error);
    queueItems.value = [];
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
onMounted(() => {
  // Initial fetch
  fetchQueueItems();

  // Subscribe to queue item updates
  const unsub1 = api.subscribe(
    EventType.QUEUE_ITEMS_UPDATED,
    (evt: EventMessage) => {
      if (evt.object_id !== store.activePlayerQueue?.queue_id) return;
      fetchQueueItems();
    },
  );

  // Subscribe to queue updates (for index changes)
  const unsub2 = api.subscribe(EventType.QUEUE_UPDATED, (evt: EventMessage) => {
    if (evt.object_id !== store.activePlayerQueue?.queue_id) return;
    fetchQueueItems();
  });

  // Setup idle detection
  const events = ["mousemove", "keydown", "touchstart", "click"];
  events.forEach((event) => {
    window.addEventListener(event, resetIdleTimer);
  });
  resetIdleTimer();

  onBeforeUnmount(() => {
    unsub1();
    unsub2();
    if (idleTimer) clearTimeout(idleTimer);
    events.forEach((event) => {
      window.removeEventListener(event, resetIdleTimer);
    });
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
.jukebox-view {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.jukebox-content {
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

.qr-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-box {
  width: 250px;
  height: 250px;
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
}

.qr-icon {
  opacity: 0.5;
  color: rgba(255, 255, 255, 0.5);
}

.qr-text {
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.qr-subtext {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.track-stack {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.track-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.track-section.current {
  flex: 0 0 auto;
}

.track-section.previous,
.track-section.next {
  flex: 1;
  justify-content: center;
}

/* Transition animations */
.track-slide-enter-active,
.track-slide-leave-active {
  transition: all 0.5s ease;
}

.track-slide-enter-from {
  opacity: 0;
  transform: translateY(50px);
}

.track-slide-leave-to {
  opacity: 0;
  transform: translateY(-50px);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .jukebox-content {
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
  }

  .qr-section {
    flex: 0 0 120px;
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

  .jukebox-content {
    padding: 0.5rem;
  }

  .track-stack {
    gap: 0.5rem;
  }

  .track-section {
    gap: 0.5rem;
  }
}
</style>
