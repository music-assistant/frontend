<template>
  <div
    class="result-item"
    :class="{
      'result-item--expanded': isExpanded,
      'result-item--clickable': item.media_type === 'track',
    }"
    @click="onItemClick"
  >
    <div class="result-info">
      <v-avatar size="56" rounded class="result-avatar">
        <v-img :src="imageUrl" :alt="item.name" cover>
          <template #placeholder>
            <div class="avatar-placeholder">
              <v-icon>mdi-music</v-icon>
            </div>
          </template>
        </v-img>
      </v-avatar>
      <div class="result-text">
        <MarqueeText class="result-name">
          {{ item.name }}
        </MarqueeText>
        <MarqueeText class="result-artist">
          {{ artistName }}
        </MarqueeText>
      </div>
    </div>

    <!-- Actions for tracks (shown when expanded) -->
    <template v-if="item.media_type === 'track' && isExpanded">
      <div class="result-spacer"></div>
      <div class="result-actions">
        <v-btn
          v-if="boostEnabled"
          variant="elevated"
          :loading="addingItems.has(`${item.media_type}-${item.item_id}-next`)"
          :disabled="rateLimitingEnabled && boostTokens <= 0"
          class="boost-btn action-btn"
          :style="{ backgroundColor: boostBadgeColor }"
          @click.stop="$emit('addToQueue', item, 'next')"
        >
          <v-icon start>mdi-rocket-launch</v-icon>
          {{ $t("providers.party_mode.boost") }}
        </v-btn>
        <v-btn
          v-if="addQueueEnabled"
          variant="elevated"
          :loading="addingItems.has(`${item.media_type}-${item.item_id}-end`)"
          :disabled="rateLimitingEnabled && addQueueTokens <= 0"
          class="add-btn action-btn"
          :style="{ backgroundColor: requestBadgeColor }"
          @click.stop="$emit('addToQueue', item, 'end')"
        >
          <v-icon start>mdi-playlist-plus</v-icon>
          {{ $t("providers.party_mode.request") }}
        </v-btn>
      </div>
    </template>

    <!-- Actions for artists -->
    <template v-else-if="item.media_type === 'artist'">
      <div class="result-spacer"></div>
      <div class="result-actions">
        <v-btn
          variant="text"
          class="action-btn"
          @click.stop="$emit('selectArtist', item)"
        >
          <v-icon start>mdi-music-note-outline</v-icon>
          {{ $t("providers.party_mode.guest_page.view_songs") }}
        </v-btn>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Artist, Track } from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import { getMediaItemImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import MarqueeText from "@/components/MarqueeText.vue";

const props = defineProps<{
  item: Track | Artist;
  boostEnabled: boolean;
  addQueueEnabled: boolean;
  rateLimitingEnabled: boolean;
  boostTokens: number;
  addQueueTokens: number;
  boostBadgeColor: string;
  requestBadgeColor: string;
  addingItems: Set<string>;
  isExpanded: boolean;
}>();

const emit = defineEmits<{
  addToQueue: [item: Track | Artist, position: "next" | "end"];
  selectArtist: [item: Track | Artist];
  toggleExpand: [itemId: string];
}>();

const onItemClick = () => {
  if (props.item.media_type === MediaType.TRACK) {
    emit("toggleExpand", `${props.item.media_type}-${props.item.item_id}`);
  }
};

const imageUrl = computed(() => {
  const img = props.item.metadata?.images?.[0];
  return img ? getMediaItemImageUrl(img) : "";
});

const artistName = computed(() => {
  if (props.item.media_type === MediaType.ARTIST) {
    return $t("artist");
  }
  if ("artists" in props.item && props.item.artists.length > 0) {
    return props.item.artists.map((a) => a.name).join(", ");
  }
  return $t("providers.party_mode.guest_page.unknown_artist");
});
</script>

<style scoped>
.result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(var(--v-theme-surface-variant), 0.07);
  border-radius: 12px;
  min-height: 72px;
  transition: background 0.2s ease;
}

.result-item--clickable {
  cursor: pointer;
}

.result-item--expanded {
  background: rgba(var(--v-theme-primary), 0.1);
}

.result-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.result-avatar {
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
.result-artist {
  font-size: 1rem;
  font-weight: 500;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-type {
  text-transform: capitalize;
  opacity: 0.7;
}

.result-spacer {
  display: none;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-shrink: 0;
  margin-left: auto;
}

.action-btn {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  color: var(--primary-foreground);
}

.action-btn.boost-btn {
  color: white;
}

.action-btn.add-btn {
  color: white;
}

.action-btn.v-btn--disabled {
  opacity: 0.3;
  background-color: rgba(var(--v-theme-on-surface), 0.08) !important;
  color: rgba(var(--v-theme-on-surface), 0.4) !important;
}

@media (max-width: 768px) {
  .result-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    min-height: auto;
    padding: 0.75rem;
  }

  .result-info {
    width: 100%;
    overflow: visible;
  }

  .result-text {
    overflow: hidden;
  }

  .result-spacer {
    display: block;
    background: #2d2d2d;
    height: 1px;
    margin: 6px 16px;
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
</style>
