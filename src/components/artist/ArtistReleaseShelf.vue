<template>
  <EditorialShelf class="artist-shelf" :gap="14" :tiles-per-view="tilesPerView">
    <template #header>
      <div
        v-hold="onHold"
        class="artist-shelf__titles"
        @touchstart.passive="onTouchStart"
        @click.capture="swallowClickAfterHold"
      >
        <h2 class="artist-shelf__title">{{ title }}</h2>
        <span v-if="meta" class="artist-shelf__meta">{{ meta }}</span>
      </div>
    </template>
    <template v-if="viewAllTo" #actions>
      <RouterLink
        :to="viewAllTo"
        class="artist-shelf__more"
        :aria-label="$t('tooltip.view_all', { name: title })"
      >
        {{ $t("view_all") }}
      </RouterLink>
    </template>

    <template v-if="items">
      <EditorialMediaCard
        v-for="item in items"
        :key="item.uri"
        :item="item"
        :parent-item="parentItem"
        :is-available="itemIsAvailable(item)"
      >
        <template #art-overlay>
          <span class="artist-shelf__art-scrim"></span>
          <span v-if="item.year" class="artist-shelf__year">{{
            item.year
          }}</span>
        </template>
        <template #subtitle>{{ subtitle(item) }}</template>
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
import {
  AlbumType,
  type Album,
  type ItemMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

export interface Props {
  title: string;
  // the line beside the title, e.g. "11 · newest first"
  meta?: string;
  // undefined while the row is still loading
  items?: Array<Album | ItemMapping>;
  viewAllTo?: RouteLocationRaw;
  // "lg" is the albums shelf, "md" the smaller singles / appearances ones
  size?: "lg" | "md";
  parentItem?: MediaItemType;
}
const props = withDefaults(defineProps<Props>(), {
  meta: undefined,
  items: undefined,
  viewAllTo: undefined,
  size: "md",
  parentItem: undefined,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const SKELETONS = 6;

const tilesPerView = computed(() => shelfTilesPerView(props.size));

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);

const subtitle = function (item: Album | ItemMapping): string {
  const parts: string[] = [];
  if ("album_type" in item && item.album_type !== AlbumType.UNKNOWN) {
    parts.push($t(`album_type.${item.album_type}`));
  }
  if (item.year) parts.push(String(item.year));
  return parts.join(" · ");
};

/**
 * Tiles per viewport width, following the same curve as the Discover shelves
 * but one step tighter so the cards land on the artist page's smaller sizes.
 */
function shelfTilesPerView(size: "lg" | "md"): number {
  const isPhone = getBreakpointValue({ breakpoint: "bp1", condition: "lt" });
  if (size === "lg") return isPhone ? 2.4 : panelViewItemResponsive(0) + 1.5;
  return isPhone ? 3.2 : panelViewItemResponsive(0) + 2.5;
}
</script>

<style scoped>
.artist-shelf__titles {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.artist-shelf__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artist-shelf__meta {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
}
.artist-shelf__more {
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  white-space: nowrap;
}
.artist-shelf__more:hover,
.artist-shelf__more:focus-visible {
  text-decoration: underline;
}
.artist-shelf__art-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.05) 0%,
    rgba(0, 0, 0, 0.35) 60%,
    rgba(0, 0, 0, 0.7) 100%
  );
}
.artist-shelf__year {
  position: absolute;
  left: 10px;
  bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
}

@media (max-width: 768px) {
  .artist-shelf__title {
    font-size: 19px;
  }
}
</style>
