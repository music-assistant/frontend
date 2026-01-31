<template>
  <div
    v-if="queueItem"
    :class="[
      'track-card',
      `position-${position}`,
      { 'guest-request': isGuestRequest },
    ]"
    :style="isGuestRequest ? { '--guest-color': badgeColor } : {}"
  >
    <div :class="['track-artwork', sizeClass]">
      <MediaItemThumb :item="queueItem" :size="artworkSize" />
    </div>
    <div :class="['track-info', sizeClass]">
      <div class="track-name">
        <MarqueeText :disabled="position !== 'current'">
          {{ trackName }}
        </MarqueeText>
      </div>
      <div v-if="artistName" class="track-artist">
        <MarqueeText :disabled="position !== 'current'">
          {{ artistName }}
        </MarqueeText>
      </div>
    </div>
    <!-- Guest request badge -->
    <div
      v-if="isGuestRequest"
      class="guest-badge"
      :style="{ '--badge-color': badgeColor }"
    >
      <v-icon size="small">{{
        isBoost ? "mdi-rocket-launch" : "mdi-account-music"
      }}</v-icon>
      <span v-if="position === 'current'">{{ badgeText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import MarqueeText from "@/components/MarqueeText.vue";
import type { QueueItem } from "@/plugins/api/interfaces";

export interface Props {
  queueItem?: QueueItem;
  position: "previous-2" | "previous-1" | "current" | "next-1" | "next-2";
  requestBadgeColor?: string;
  boostBadgeColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  queueItem: undefined,
  requestBadgeColor: "#2196F3", // Default: Blue
  boostBadgeColor: "#FF5722", // Default: Orange
});

// Check if this is a guest request
const isGuestRequest = computed(() => {
  return props.queueItem?.extra_attributes?.added_by_user_role === "guest";
});

// Check if this was added via "Boost"
const isBoost = computed(() => {
  return props.queueItem?.extra_attributes?.queue_option === "next";
});

// Get the badge color based on queue option (fallback to defaults if empty)
const badgeColor = computed(() => {
  const color = isBoost.value ? props.boostBadgeColor : props.requestBadgeColor;
  // Fallback to defaults if color is empty (before config loads)
  if (!color) return isBoost.value ? "#FF5722" : "#2196F3";
  return color;
});

// Get badge text based on queue option
const badgeText = computed(() => {
  if (!isGuestRequest.value) return "";
  if (isBoost.value) return "Boost";
  return "Request";
});

// Computed track name - prefer media_item.name for proper track title
const trackName = computed(() => {
  if (!props.queueItem) return "";
  // For radio streams, stream_metadata.title contains the current track
  const streamTitle = props.queueItem.streamdetails?.stream_metadata?.title;
  if (streamTitle) return streamTitle;
  // Use media_item.name for proper track title (not "Artist - Title" format)
  if (props.queueItem.media_item && "name" in props.queueItem.media_item) {
    return props.queueItem.media_item.name;
  }
  // Fallback to queue item name
  return props.queueItem.name;
});

// Computed subtitle - shows "Artist - Album" or just artist for streams
const artistName = computed(() => {
  if (!props.queueItem) return "";

  // For radio streams, just show the artist
  const streamArtist = props.queueItem.streamdetails?.stream_metadata?.artist;
  if (streamArtist) return streamArtist;

  // Build "Artist - Album" format for regular tracks
  const parts: string[] = [];

  // Get artist name(s)
  if (
    props.queueItem.media_item &&
    "artists" in props.queueItem.media_item &&
    props.queueItem.media_item.artists?.length
  ) {
    const artistStr = props.queueItem.media_item.artists
      .map((a: { name: string }) => a.name)
      .join(", ");
    parts.push(artistStr);
  }

  // Get album name
  if (
    props.queueItem.media_item &&
    "album" in props.queueItem.media_item &&
    props.queueItem.media_item.album?.name
  ) {
    parts.push(props.queueItem.media_item.album.name);
  }

  return parts.join(" • ");
});

const artworkSize = computed(() => {
  switch (props.position) {
    case "previous-2":
    case "next-2":
    case "previous-1":
    case "next-1":
      return 120;
    case "current":
      return 200;
    default:
      return 120;
  }
});

// Size class used by both artwork and info sections
const sizeClass = computed(() => {
  return props.position === "current" ? "size-large" : "size-medium";
});
</script>

<style scoped>
.track-card {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  align-items: center;
  gap: 1.5vw;
  padding: 1vw;
  border-radius: 1.2vw;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(1vw);
  width: 95%;
  max-width: 95%;
  box-sizing: border-box;
  /* Transform combines centering, vertical position, and scale */
  transform: translateX(-50%) translateY(calc(-50% + var(--y, 0vh)))
    scale(var(--scale, 1));
  opacity: var(--opacity, 1);
  z-index: var(--z-index, 1);
  /* Transition the actual CSS properties, not the variables */
  transition:
    transform 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-card.position-previous-2 {
  --y: -30vh;
  --scale: 0.85;
  --opacity: 0.5;
  --z-index: 1;
}

.track-card.position-previous-1 {
  --y: -19vh;
  --scale: 0.9;
  --opacity: 0.7;
  --z-index: 2;
}

.track-card.position-current {
  --y: 0vh;
  --scale: 1;
  --opacity: 1;
  --z-index: 3;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0.8vh 3.2vh rgba(0, 0, 0, 0.3);
}

/* Guest request highlighting - color set via inline style from config */
.track-card.guest-request {
  background: color-mix(in srgb, var(--guest-color) 20%, transparent);
  border: 2px solid color-mix(in srgb, var(--guest-color) 40%, transparent);
}

.track-card.guest-request.position-current {
  background: color-mix(in srgb, var(--guest-color) 25%, transparent);
  border: 2px solid color-mix(in srgb, var(--guest-color) 50%, transparent);
  box-shadow:
    0 0.8vh 3.2vh rgba(0, 0, 0, 0.3),
    0 0 2vh color-mix(in srgb, var(--guest-color) 30%, transparent);
}

.guest-badge {
  /* Color set via inline style from config */
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  background: color-mix(in srgb, var(--badge-color) 35%, transparent);
  border: 1px solid color-mix(in srgb, var(--badge-color) 55%, transparent);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
  margin-left: auto;
}

.track-card.position-next-1 {
  --y: 19vh;
  --scale: 0.9;
  --opacity: 0.7;
  --z-index: 2;
}

.track-card.position-next-2 {
  --y: 30vh;
  --scale: 0.85;
  --opacity: 0.5;
  --z-index: 1;
}

.track-artwork {
  flex-shrink: 0;
  border-radius: 0.8vw;
  overflow: hidden;
  transition:
    width 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-artwork.size-small {
  width: 8vh;
  height: 8vh;
}

.track-artwork.size-medium {
  width: 12vh;
  height: 12vh;
}

.track-artwork.size-large {
  width: 20vh;
  height: 20vh;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-name {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.95);
  transition: font-size 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-artist {
  color: rgba(255, 255, 255, 0.7);
  transition: font-size 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-info.size-small .track-name {
  font-size: 1rem;
}

.track-info.size-small .track-artist {
  font-size: 0.875rem;
}

.track-info.size-medium .track-name {
  font-size: 1.25rem;
}

.track-info.size-medium .track-artist {
  font-size: 1rem;
}

.track-info.size-large .track-name {
  font-size: 2rem;
}

.track-info.size-large .track-artist {
  font-size: 1.5rem;
}

@media (max-width: 1024px) {
  .track-card {
    gap: 1rem;
    padding: 0.75rem;
  }

  .track-info.size-large .track-name {
    font-size: 1.5rem;
  }

  .track-info.size-large .track-artist {
    font-size: 1.2rem;
  }
}

@media (max-width: 768px) {
  .track-card {
    gap: 0.75rem;
    padding: 0.5rem;
  }

  .track-artwork.size-large {
    width: 12vh;
    height: 12vh;
  }

  .track-info.size-large .track-name {
    font-size: 1.2rem;
  }

  .track-info.size-large .track-artist {
    font-size: 1rem;
  }
}
</style>
