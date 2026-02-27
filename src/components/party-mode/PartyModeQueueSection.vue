<template>
  <div class="queue-section">
    <h2 class="section-title">{{ $t("guest.current_queue") }}</h2>
    <div
      v-if="queueItems.length > 0"
      ref="listRef"
      class="queue-list"
      @scroll="$emit('queueScroll', $event)"
    >
      <PartyModeQueueItem
        v-for="(item, index) in queueItems"
        :key="item.queue_item_id"
        :item="item"
        :index="index"
        :queue-fetch-offset="queueFetchOffset"
        :current-queue-index="currentQueueIndex"
        :is-playing="isPlaying"
        :skip-song-enabled="skipSongEnabled"
        :rate-limiting-enabled="rateLimitingEnabled"
        :skip-song-tokens="skipSongTokens"
        :skipping-song="skippingSong"
        :skip-token-countdown="skipTokenCountdown"
        :boost-badge-color="boostBadgeColor"
        :request-badge-color="requestBadgeColor"
        @skip="$emit('skip')"
      />
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
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { QueueItem } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import PartyModeQueueItem from "./PartyModeQueueItem.vue";

const props = defineProps<{
  queueItems: QueueItem[];
  queueFetchOffset: number;
  currentQueueIndex: number;
  isPlaying: boolean;
  loadingMoreQueueItems: boolean;
  skipSongEnabled: boolean;
  rateLimitingEnabled: boolean;
  skipSongTokens: number;
  skippingSong: boolean;
  skipTokenCountdown: string;
  boostBadgeColor: string;
  requestBadgeColor: string;
}>();

defineEmits<{
  skip: [];
  queueScroll: [event: Event];
}>();

const listRef = ref<HTMLElement | null>(null);

// Expose the list ref so the parent's composable can use it for auto-scroll
defineExpose({ listRef });

// Sync listRef to the composable's queueListRef via a watcher pattern
// The parent will set up the connection
</script>

<style scoped>
.queue-section {
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.2);
  flex: none;
  margin-bottom: 0.5rem;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.loading-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
}

.empty-queue {
  text-align: center;
  padding: 2rem;
  opacity: 0.5;
}

@media (max-width: 768px) {
  .section-title {
    font-size: 1.25rem;
    padding-bottom: 0.25rem;
  }
}
</style>
