<template>
  <div class="queue-section">
    <div class="section-header">
      <h2 class="section-title">
        {{ $t("providers.party.guest_page.current_queue") }}
      </h2>
      <div v-if="skipSongEnabled" class="skip-area">
        <span
          v-if="
            rateLimitingEnabled && skipSongTokens <= 0 && skipTokenCountdown
          "
          class="skip-countdown"
        >
          <Clock :size="12" />
          {{ skipTokenCountdown }}
        </span>
        <Button
          size="sm"
          :disabled="
            (rateLimitingEnabled && skipSongTokens <= 0) || skippingSong
          "
          class="skip-btn"
          @click="$emit('skip')"
        >
          <Spinner v-if="skippingSong" :size="16" />
          <SkipForward v-else :size="16" />
          {{ $t("providers.party.guest_page.skip") }}
          <span
            v-if="rateLimitingEnabled"
            class="skip-token-badge"
            :class="{ 'no-tokens': skipSongTokens <= 0 }"
          >
            {{ skipSongTokens }}
          </span>
        </Button>
      </div>
    </div>
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
        :boost-badge-color="boostBadgeColor"
        :request-badge-color="requestBadgeColor"
        :boost-enabled="boostEnabled"
        :rate-limiting-enabled="rateLimitingEnabled"
        :boost-tokens="boostTokens"
        :boosting="boostingItemId === item.queue_item_id"
        :is-expanded="expandedQueueItemId === item.queue_item_id"
        @boost="handleBoost"
        @toggle-expand="toggleExpandedItem"
      />
      <!-- Loading indicator for infinite scroll -->
      <div v-if="loadingMoreQueueItems" class="loading-more">
        <Spinner class="size-8 text-primary" />
      </div>
    </div>
    <div v-else class="empty-queue">
      <ListMusic :size="48" class="text-muted-foreground" />
      <p>{{ $t("providers.party.guest_page.queue_empty") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { QueueItem } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import PartyModeQueueItem from "./PartyModeQueueItem.vue";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { Clock, ListMusic, SkipForward } from "lucide-vue-next";

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
  boostEnabled: boolean;
  boostTokens: number;
  boostingItemId: string;
}>();

const emit = defineEmits<{
  skip: [];
  queueScroll: [event: Event];
  boostQueueItem: [item: QueueItem];
}>();

const expandedQueueItemId = ref("");

const toggleExpandedItem = (queueItemId: string) => {
  expandedQueueItemId.value =
    expandedQueueItemId.value === queueItemId ? "" : queueItemId;
};

const handleBoost = (item: QueueItem) => {
  expandedQueueItemId.value = "";
  emit("boostQueueItem", item);
};

const listRef = ref<HTMLElement | null>(null);

// Expose the list ref so the parent's composable can use it for auto-scroll
defineExpose({ listRef });
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

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.2);
  margin-bottom: 0.5rem;
  flex: none;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.skip-area {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.skip-btn {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
}

.skip-token-badge {
  margin-left: 0.5rem;
  padding: 0.125rem 0.375rem;
  background: rgba(var(--v-theme-on-primary), 0.2);
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
}

.skip-token-badge.no-tokens {
  background: rgba(var(--v-theme-error), 0.3);
}

.skip-btn:disabled {
  opacity: 0.3;
}

.skip-countdown {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
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
    font-size: 1rem;
  }
}
</style>
