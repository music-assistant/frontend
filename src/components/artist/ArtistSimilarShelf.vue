<template>
  <EditorialShelf
    class="artist-similar"
    :gap="14"
    :tiles-per-view="tilesPerView"
  >
    <template #header>
      <div
        v-hold="onHold"
        class="artist-similar__titles"
        @touchstart.passive="onTouchStart"
        @click.capture="swallowClickAfterHold"
      >
        <h2 class="artist-similar__title">{{ $t("similar_artists") }}</h2>
        <span v-if="sourceLabel" class="artist-similar__meta">{{
          $t("via_provider", { provider: sourceLabel })
        }}</span>
      </div>
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
    </template>
    <template v-else>
      <EditorialCardSkeleton v-for="index in SKELETONS" :key="index" />
    </template>
  </EditorialShelf>
</template>

<script setup lang="ts">
import EditorialCardSkeleton from "@/components/discover/EditorialCardSkeleton.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { panelViewItemResponsive } from "@/helpers/utils";
import { itemIsAvailable } from "@/plugins/api/helpers";
import type { Artist } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { computed } from "vue";

export interface Props {
  // undefined while the row is still loading
  items?: Artist[];
  // provider name when a single provider feeds the row
  sourceLabel?: string;
}
defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const SKELETONS = 6;

const tilesPerView = computed(() =>
  getBreakpointValue({ breakpoint: "bp1", condition: "lt" })
    ? 3.2
    : panelViewItemResponsive(0) + 2.5,
);

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);
</script>

<style scoped>
.artist-similar__titles {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.artist-similar__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist-similar__meta {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
}
/* the round cards read as portraits, so their captions are centred */
.artist-similar :deep(.ed-card--round .ed-card__meta) {
  text-align: center;
}

@media (max-width: 768px) {
  .artist-similar__title {
    font-size: 19px;
  }
}
</style>
