<template>
  <div class="result-item">
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
          <span v-if="item.media_type === 'artist'" class="result-type">
            • {{ $t("artist") }}
          </span>
        </MarqueeText>
      </div>
    </div>

    <!-- Actions for tracks -->
    <div v-if="item.media_type === 'track'" class="result-actions">
      <v-btn
        v-if="boostEnabled"
        variant="elevated"
        :loading="addingItems.has(`${item.media_type}-${item.item_id}-next`)"
        :disabled="rateLimitingEnabled && boostTokens <= 0"
        class="action-btn"
        :style="{ backgroundColor: boostBadgeColor, color: '#fff' }"
        @click="$emit('addToQueue', item, 'next')"
      >
        <v-icon start>mdi-rocket-launch</v-icon>
        {{ $t("guest.boost") }}
      </v-btn>
      <v-btn
        v-if="addQueueEnabled"
        variant="elevated"
        :loading="addingItems.has(`${item.media_type}-${item.item_id}-end`)"
        :disabled="rateLimitingEnabled && addQueueTokens <= 0"
        class="action-btn"
        :style="{ backgroundColor: requestBadgeColor, color: '#fff' }"
        @click="$emit('addToQueue', item, 'end')"
      >
        <v-icon start>mdi-playlist-plus</v-icon>
        {{ $t("guest.add") }}
      </v-btn>
    </div>

    <!-- Actions for artists -->
    <div v-else-if="item.media_type === 'artist'" class="result-actions">
      <v-btn
        color="primary"
        variant="elevated"
        class="action-btn action-btn-primary"
        @click="$emit('selectArtist', item)"
      >
        <v-icon start>mdi-music-note-outline</v-icon>
        {{ $t("guest.view_songs") }}
      </v-btn>
    </div>
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
}>();

defineEmits<{
  addToQueue: [item: Track | Artist, position: "next" | "end"];
  selectArtist: [item: Track | Artist];
}>();

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
  return $t("guest.unknown_artist");
});
</script>

<style scoped>
.result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(var(--v-theme-surface-variant), 0.25);
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  min-height: 72px;
}

.result-item:hover {
  background: rgba(var(--v-theme-surface-variant), 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  border-color: rgba(var(--v-theme-primary), 0.3);
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

.result-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}

.action-btn {
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
}

.action-btn-primary {
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  box-shadow: 0 2px 8px rgba(var(--v-theme-primary), 0.4) !important;
}

.action-btn-primary:hover {
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.6) !important;
  transform: translateY(-1px);
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
