<template>
  <EditorialShelf
    class="release-shelf"
    :gap="14"
    :tiles-per-view="tilesPerView"
  >
    <template #header>
      <div
        v-hold="onHold"
        class="release-shelf__titles"
        @touchstart.passive="onTouchStart"
        @click.capture="swallowClickAfterHold"
      >
        <h2 class="release-shelf__title">{{ title }}</h2>
        <RowSourceBadge
          v-if="sourceLabel"
          :label="sourceLabel"
          :domain="sourceDomain"
        />
        <span v-else-if="meta" class="release-shelf__meta">{{ meta }}</span>
      </div>
    </template>
    <template v-if="viewAllTo" #actions>
      <RouterLink
        :to="viewAllTo"
        class="release-shelf__more"
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
          <span class="release-shelf__art-scrim"></span>
          <span
            v-if="isExplicit(item)"
            class="release-shelf__explicit"
            :aria-label="$t('tooltip.explicit')"
          >
            <v-icon icon="mdi-alpha-e-box" size="20" />
          </span>
          <span v-if="item.year" class="release-shelf__year">{{
            item.year
          }}</span>
        </template>
        <template #subtitle>{{ subtitle(item) }}</template>
      </EditorialMediaCard>
      <div
        v-if="items.length === 0 && emptyMessage"
        class="release-shelf__empty"
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
import EditorialCardSkeleton from "@/components/discover/EditorialCardSkeleton.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import RowSourceBadge from "@/components/details/RowSourceBadge.vue";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { parseBool } from "@/helpers/parse";
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
  // the line beside the title, e.g. the "appears on" hint
  meta?: string;
  // the row's source, shown as a badge instead of `meta` (e.g. "In your library")
  sourceLabel?: string;
  // provider domain behind `sourceLabel`, for its icon
  sourceDomain?: string;
  // undefined while the row is still loading
  items?: Array<Album | ItemMapping>;
  viewAllTo?: RouteLocationRaw;
  // shown in place of the tiles when the row loaded nothing
  emptyMessage?: string;
  parentItem?: MediaItemType;
}
const props = withDefaults(defineProps<Props>(), {
  meta: undefined,
  sourceLabel: undefined,
  sourceDomain: undefined,
  items: undefined,
  viewAllTo: undefined,
  emptyMessage: undefined,
  parentItem: undefined,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const SKELETONS = 6;

const tilesPerView = computed(() => shelfTilesPerView());

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);

// the item's type, so every card says what it is; the year already sits on the
// artwork, so it isn't repeated here
const subtitle = function (item: Album | ItemMapping): string {
  if ("album_type" in item && item.album_type !== AlbumType.UNKNOWN) {
    return $t(`album_type.${item.album_type}`);
  }
  return $t(item.media_type);
};

const isExplicit = function (item: Album | ItemMapping): boolean {
  return (
    "metadata" in item &&
    !!item.metadata &&
    parseBool(item.metadata.explicit || false)
  );
};

/**
 * Tiles per viewport width, following the same curve as the Discover shelves
 * but one step tighter so the cards land on the detail pages' smaller sizes.
 * Every release row uses it, so a single and an album are the same size.
 */
function shelfTilesPerView(): number {
  const isPhone = getBreakpointValue({ breakpoint: "bp1", condition: "lt" });
  return isPhone ? 2.4 : panelViewItemResponsive(0) + 1.5;
}
</script>

<style scoped>
.release-shelf__titles {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.release-shelf__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.release-shelf__meta {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
}
.release-shelf__more {
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  white-space: nowrap;
}
.release-shelf__more:hover,
.release-shelf__more:focus-visible {
  text-decoration: underline;
}
.release-shelf__art-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.05) 0%,
    rgba(0, 0, 0, 0.35) 60%,
    rgba(0, 0, 0, 0.7) 100%
  );
}
.release-shelf__year {
  position: absolute;
  left: 10px;
  bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
}
.release-shelf__explicit {
  position: absolute;
  top: 4px;
  right: 4px;
  display: inline-flex;
  color: #fff;
  opacity: 0.9;
}
.release-shelf__empty {
  align-self: center;
  padding: 8px 4px;
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

@media (max-width: 768px) {
  .release-shelf__title {
    font-size: 19px;
  }
}
</style>
