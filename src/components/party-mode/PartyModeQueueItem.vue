<template>
  <div
    class="queue-item"
    :class="{
      'queue-item-current': absoluteIndex === currentQueueIndex,
      'queue-item-played': absoluteIndex < currentQueueIndex,
      'queue-item--expanded': isExpanded,
    }"
    @click="onItemClick"
  >
    <div class="queue-item-row">
      <div class="queue-position">
        <NowPlayingBadge
          v-if="absoluteIndex === currentQueueIndex && isPlaying"
          :show-badge="false"
        />
        <span v-else class="queue-number">{{ absoluteIndex + 1 }}</span>
      </div>
      <v-avatar size="48" rounded class="queue-avatar">
        <v-img :src="imageUrl" :alt="item.name" cover>
          <template #placeholder>
            <div class="avatar-placeholder">
              <v-icon>mdi-music</v-icon>
            </div>
          </template>
        </v-img>
      </v-avatar>
      <div class="queue-info">
        <MarqueeText class="queue-name">
          {{ title }}
        </MarqueeText>
        <MarqueeText class="queue-artist">
          {{ subtitle }}
        </MarqueeText>
      </div>

      <!-- Guest request badge -->
      <span
        v-if="item.extra_attributes?.party_mode_guest === true"
        class="guest-request-badge"
        :style="{ '--badge-color': badgeColor }"
      >
        <v-icon size="x-small">{{ badgeIcon }}</v-icon>
        <span>{{ badgeLabel }}</span>
      </span>
    </div>

    <!-- Boost action (shown when expanded on upcoming items) -->
    <div v-if="isExpanded && canBoost" class="queue-item-actions">
      <v-btn
        variant="elevated"
        size="small"
        :loading="boosting"
        :disabled="boostDisabled"
        class="boost-btn"
        :style="{ backgroundColor: boostBadgeColor }"
        @click.stop="$emit('boost', item)"
      >
        <v-icon start size="small">mdi-rocket-launch</v-icon>
        {{ $t("providers.party_mode.boost") }}
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { QueueItem } from "@/plugins/api/interfaces";
import { getMediaItemImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import MarqueeText from "@/components/MarqueeText.vue";
import NowPlayingBadge from "@/components/NowPlayingBadge.vue";

const props = defineProps<{
  item: QueueItem;
  index: number;
  queueFetchOffset: number;
  currentQueueIndex: number;
  isPlaying: boolean;
  boostBadgeColor: string;
  requestBadgeColor: string;
  boostEnabled: boolean;
  rateLimitingEnabled: boolean;
  boostTokens: number;
  boosting: boolean;
  isExpanded: boolean;
}>();

const emit = defineEmits<{
  boost: [item: QueueItem];
  toggleExpand: [queueItemId: string];
}>();

const canBoost = computed(
  () => props.boostEnabled && absoluteIndex.value > props.currentQueueIndex,
);

const boostDisabled = computed(
  () => props.rateLimitingEnabled && props.boostTokens <= 0,
);

const onItemClick = () => {
  if (absoluteIndex.value > props.currentQueueIndex) {
    emit("toggleExpand", props.item.queue_item_id);
  }
};

const absoluteIndex = computed(() => props.queueFetchOffset + props.index);

const imageUrl = computed(() => {
  if (!props.item.image) return "";
  return getMediaItemImageUrl(props.item.image);
});

const title = computed(() => {
  return props.item.media_item?.name || props.item.name;
});

const subtitle = computed(() => {
  const mediaItem = props.item.media_item;
  const parts: string[] = [];

  if (mediaItem && "artists" in mediaItem && mediaItem.artists.length > 0) {
    parts.push(mediaItem.artists.map((a) => a.name).join(", "));
  }

  if (mediaItem && "album" in mediaItem && mediaItem.album?.name) {
    parts.push(mediaItem.album.name);
  }

  return parts.length > 0
    ? parts.join(" • ")
    : $t("providers.party_mode.guest_page.unknown_artist");
});

const isBoosted = computed(
  () => props.item.extra_attributes?.party_mode_boosted === true,
);

const badgeColor = computed(() =>
  isBoosted.value ? props.boostBadgeColor : props.requestBadgeColor,
);

const badgeIcon = computed(() =>
  isBoosted.value ? "mdi-rocket-launch" : "mdi-account-music",
);

const badgeLabel = computed(() =>
  isBoosted.value
    ? $t("providers.party_mode.boost")
    : $t("providers.party_mode.request"),
);
</script>

<style scoped>
.queue-item {
  display: flex;
  flex-direction: column;
  padding: 0 0.75rem;
  background: rgba(var(--v-theme-surface-variant), 0.05);
  border-radius: 8px;
  min-height: 80px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.queue-item--expanded {
  background: rgba(var(--v-theme-primary), 0.1);
}

.queue-item-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 80px;
}

.queue-item-actions {
  display: flex;
  justify-content: center;
  padding: 0 0 0.5rem;
}

.queue-item-actions .boost-btn {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  color: white;
  flex: 1;
}

.queue-item-current {
  background: rgba(var(--v-theme-primary), 0.15);
  border-left: 6px solid rgb(var(--v-theme-primary));
  padding-left: calc(0.75rem - 3px);
}

.queue-item-played {
  background: rgba(0, 0, 0, 0.2);
  opacity: 0.5;
}

.queue-position {
  width: 20px;
  margin-right: -5px;
  text-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.queue-position :deep(.now-playing-icon) {
  margin: 0;
}

.queue-number {
  font-size: 0.875rem;
  opacity: 0.6;
}

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

.queue-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.queue-name,
.queue-artist {
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guest-request-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.3rem;
  background: color-mix(in srgb, var(--badge-color) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
  border-radius: 999px;
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--badge-color);
  flex-shrink: 0;
  margin-left: auto;
}
</style>
