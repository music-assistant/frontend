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
      <div
        v-if="queueItem.media_item && 'artists' in queueItem.media_item"
        class="track-artist"
      >
        <MarqueeText :disabled="position !== 'current'">
          {{
            queueItem.media_item.artists?.map((a: any) => a.name).join(", ") ||
            ""
          }}
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
  width: 100%;
  max-width: 80vw;
  /* Transform combines centering, vertical position, and scale */
  transform: translateX(-50%) translateY(calc(-50% + var(--y, 0vh)))
    scale(var(--scale, 1));
  opacity: var(--opacity, 1);
  z-index: var(--z-index, 1);
  /* Transition the actual CSS properties, not the variables */
  transition:
    transform 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.8s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-card.position-previous-2 {
  --y: -30vh;
  --scale: 0.85;
  --opacity: 0.5;
  --z-index: 1;
  max-width: 68vw;
}

.track-card.position-previous-1 {
  --y: -19vh;
  --scale: 0.9;
  --opacity: 0.7;
  --z-index: 2;
  max-width: 72vw;
}

.track-card.position-current {
  --y: 0vh;
  --scale: 1;
  --opacity: 1;
  --z-index: 3;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 0.8vh 3.2vh rgba(0, 0, 0, 0.3);
}

.track-card.position-next-1 {
  --y: 19vh;
  --scale: 0.9;
  --opacity: 0.7;
  --z-index: 2;
  max-width: 72vw;
}

.track-card.position-next-2 {
  --y: 30vh;
  --scale: 0.85;
  --opacity: 0.5;
  --z-index: 1;
  max-width: 68vw;
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
