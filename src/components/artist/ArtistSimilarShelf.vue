<template>
  <EditorialShelf
    class="artist-similar"
    :gap="14"
    :tiles-per-view="tilesPerView"
  >
    <template #header>
      <DetailSectionTitle
        :title="title ?? $t('similar_artists')"
        @edit-rows="emit('edit-rows')"
      >
        <RowSourceBadge
          v-if="sourceLabel"
          :label="sourceLabel"
          :domain="sourceDomain"
          :options="sourceOptions"
          :selected="sourceValue"
          @select="(source) => emit('select-source', source)"
        />
      </DetailSectionTitle>
    </template>

    <template v-if="items">
      <EditorialMediaCard
        v-for="item in items"
        :key="item.uri"
        :item="item"
        round
        :is-available="itemIsAvailable(item)"
      >
        <template #subtitle>{{ $t("artist") }}</template>
      </EditorialMediaCard>
      <div
        v-if="items.length === 0 && emptyMessage"
        class="artist-similar__empty"
      >
        {{ emptyMessage }}
      </div>
    </template>
    <template v-else>
      <EditorialCardSkeleton v-for="index in SKELETONS" :key="index" />
    </template>
  </EditorialShelf>
</template>

<script setup lang="ts">
import DetailSectionTitle from "@/components/details/DetailSectionTitle.vue";
import type { RowSource, SourceOption } from "@/components/details/rowRegistry";
import RowSourceBadge from "@/components/details/RowSourceBadge.vue";
import EditorialCardSkeleton from "@/components/discover/EditorialCardSkeleton.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import { panelViewItemResponsive } from "@/helpers/utils";
import { itemIsAvailable } from "@/plugins/api/helpers";
import type { Artist, ItemMapping } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { computed } from "vue";

export interface Props {
  // undefined while the row is still loading
  items?: Array<Artist | ItemMapping>;
  // the row heading, "Similar artists" unless set
  title?: string;
  // source label for the row's badge, e.g. "All sources" or "On Spotify"
  sourceLabel?: string;
  // provider domain behind `sourceLabel`, for its icon
  sourceDomain?: string;
  // the sources the row can switch to; makes the badge a picker when >1 offered
  sourceOptions?: SourceOption[];
  // the source currently feeding the row, highlighted in the picker
  sourceValue?: RowSource;
  // shown when the row has no artists but stays mounted for its source picker
  emptyMessage?: string;
}
defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
  (e: "select-source", source: RowSource): void;
}>();

const SKELETONS = 6;

const tilesPerView = computed(() =>
  getBreakpointValue({ breakpoint: "bp1", condition: "lt" })
    ? 3.2
    : panelViewItemResponsive(0) + 2.5,
);
</script>

<style scoped>
.artist-similar__empty {
  align-self: center;
  padding: 8px 4px;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
/* the round cards read as portraits, so their captions are centred */
.artist-similar :deep(.ed-card--round .ed-card__meta) {
  text-align: center;
}
</style>
