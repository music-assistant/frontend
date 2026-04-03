<template>
  <div
    class="result-item"
    :class="{
      'result-item--expanded': isExpanded,
      'result-item--clickable':
        item.media_type === 'track' || item.media_type === 'artist',
    }"
    @click="onItemClick"
  >
    <div class="result-info">
      <Avatar class="result-avatar size-14 rounded-md">
        <AvatarImage :src="imageUrl" :alt="item.name" />
        <AvatarFallback class="avatar-placeholder rounded-md">
          <Music :size="24" />
        </AvatarFallback>
      </Avatar>
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
      <div class="result-actions">
        <Button
          v-if="boostEnabled"
          size="sm"
          :disabled="
            (rateLimitingEnabled && boostTokens <= 0) || isBoostLoading
          "
          class="boost-btn action-btn"
          :style="{ '--btn-bg': boostBadgeColor }"
          @click.stop="$emit('addToQueue', item, 'next')"
        >
          <Spinner v-if="isBoostLoading" :size="16" />
          <Rocket v-else :size="16" />
          {{ $t("providers.party.boost") }}
        </Button>
        <Button
          v-if="addQueueEnabled"
          size="sm"
          :disabled="
            (rateLimitingEnabled && addQueueTokens <= 0) || isAddLoading
          "
          class="add-btn action-btn"
          :style="{ '--btn-bg': requestBadgeColor }"
          @click.stop="$emit('addToQueue', item, 'end')"
        >
          <Spinner v-if="isAddLoading" :size="16" />
          <ListPlus v-else :size="16" />
          {{ $t("providers.party.request") }}
        </Button>
      </div>
    </template>

    <!-- Actions for artists -->
    <template v-else-if="item.media_type === 'artist'">
      <div class="result-actions">
        <Button
          variant="outline"
          size="sm"
          @click.stop="$emit('selectArtist', item as Artist)"
        >
          <Music :size="16" />
          {{ $t("providers.party.guest_page.view_songs") }}
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import MarqueeText from "@/components/MarqueeText.vue";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { getMediaItemImageUrl } from "@/helpers/utils";
import type { Artist, Track } from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ListPlus, Music, Rocket } from "lucide-vue-next";
import { computed } from "vue";

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
  selectArtist: [item: Artist];
  toggleExpand: [itemId: string];
}>();

const isBoostLoading = computed(() =>
  props.addingItems.has(`${props.item.media_type}-${props.item.item_id}-next`),
);
const isAddLoading = computed(() =>
  props.addingItems.has(`${props.item.media_type}-${props.item.item_id}-end`),
);

const onItemClick = () => {
  if (props.item.media_type === MediaType.TRACK) {
    emit("toggleExpand", `${props.item.media_type}-${props.item.item_id}`);
  } else if (props.item.media_type === MediaType.ARTIST) {
    emit("selectArtist", props.item);
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
  return $t("providers.party.guest_page.unknown_artist");
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

.result-item--clickable:hover:not(.result-item--expanded) {
  background: rgba(var(--v-theme-surface-variant), 0.14);
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

.result-name {
  font-size: 1rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-artist {
  font-size: 0.875rem;
  font-weight: 400;
  opacity: 0.6;
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

.action-btn.boost-btn,
.action-btn.add-btn {
  background-color: var(--btn-bg) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
}

.action-btn:disabled {
  opacity: 0.3;
}
</style>
