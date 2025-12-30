<template>
  <div v-if="queueItem" :class="['track-card', `position-${position}`]">
    <div :class="['track-artwork', artworkSizeClass]">
      <MediaItemThumb :item="queueItem" :size="artworkSize" />
    </div>
    <div :class="['track-info', infoSizeClass]">
      <div class="track-name">
        <MarqueeText :disabled="position !== 'current'">
          {{ queueItem.name }}
        </MarqueeText>
      </div>
      <div v-if="queueItem.media_item && 'artists' in queueItem.media_item" class="track-artist">
        <MarqueeText :disabled="position !== 'current'">
          {{ queueItem.media_item.artists?.map((a: any) => a.name).join(", ") || "" }}
        </MarqueeText>
      </div>
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
}

const props = defineProps<Props>();

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

const artworkSizeClass = computed(() => {
  switch (props.position) {
    case "previous-2":
    case "next-2":
    case "previous-1":
    case "next-1":
      return "size-medium";
    case "current":
      return "size-large";
    default:
      return "size-medium";
  }
});

const infoSizeClass = computed(() => {
  switch (props.position) {
    case "previous-2":
    case "next-2":
    case "previous-1":
    case "next-1":
      return "size-medium";
    case "current":
      return "size-large";
    default:
      return "size-medium";
  }
});
</script>

<style scoped>
.track-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  transition: all 0.5s ease-in-out;
  width: 100%;
  max-width: 800px;
}

.track-card.position-previous-2,
.track-card.position-next-2 {
  opacity: 0.5;
  transform: scale(0.85);
  max-width: 680px;
}

.track-card.position-previous-1,
.track-card.position-next-1 {
  opacity: 0.7;
  transform: scale(0.9);
  max-width: 720px;
}

.track-card.position-current {
  opacity: 1;
  transform: scale(1);
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.track-artwork {
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
}

.track-artwork.size-small {
  width: 80px;
  height: 80px;
}

.track-artwork.size-medium {
  width: 120px;
  height: 120px;
}

.track-artwork.size-large {
  width: 200px;
  height: 200px;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-name {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: rgba(255, 255, 255, 0.95);
}

.track-artist {
  color: rgba(255, 255, 255, 0.7);
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
    width: 120px;
    height: 120px;
  }

  .track-info.size-large .track-name {
    font-size: 1.2rem;
  }

  .track-info.size-large .track-artist {
    font-size: 1rem;
  }
}
</style>
