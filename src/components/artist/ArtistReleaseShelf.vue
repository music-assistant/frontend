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
      <Button
        variant="link"
        size="sm"
        as-child
        :aria-label="$t('tooltip.view_all', { name: title })"
      >
        <RouterLink :to="viewAllTo">
          {{ $t("view_all") }}
          <ChevronRight :size="16" />
        </RouterLink>
      </Button>
    </template>

    <template v-if="items">
      <EditorialMediaCard
        v-for="item in items"
        :key="item.uri"
        :item="item"
        :parent-item="parentItem"
        :is-available="itemIsAvailable(item)"
        :dimmed="showAddPill(item)"
      >
        <template #art-overlay>
          <span class="artist-shelf__art-scrim"></span>
          <span v-if="item.year" class="artist-shelf__year">{{
            item.year
          }}</span>
          <button
            v-if="showAddPill(item)"
            type="button"
            class="artist-shelf__add"
            :disabled="pendingUris.has(item.uri)"
            :title="$t('add_library')"
            :aria-label="`${$t('add_library')}: ${item.name}`"
            @click.stop="addToLibrary(item)"
          >
            <Plus :size="11" />
            {{ $t("add") }}
          </button>
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
import { isInLibrary } from "@/components/artist/artistData";
import EditorialCardSkeleton from "@/components/discover/EditorialCardSkeleton.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import { Button } from "@/components/ui/button";
import { useHoldToOpenMenu } from "@/composables/useHoldToOpenMenu";
import { panelViewItemResponsive } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  AlbumType,
  type Album,
  type ItemMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { ChevronRight, Plus } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { toast } from "vue-sonner";

export interface Props {
  title: string;
  // the line beside the title, e.g. "11 · newest first"
  meta?: string;
  // undefined while the row is still loading
  items?: Array<Album | ItemMapping>;
  viewAllTo?: RouteLocationRaw;
  // "lg" is the albums shelf, "md" the smaller singles / appearances ones
  size?: "lg" | "md";
  // offers an "Add" pill on the releases that are not in the library yet
  showLibraryState?: boolean;
  parentItem?: MediaItemType;
}
const props = withDefaults(defineProps<Props>(), {
  meta: undefined,
  items: undefined,
  viewAllTo: undefined,
  size: "md",
  showLibraryState: false,
  parentItem: undefined,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
  // a release was added to the library; the page reloads what it shows
  (e: "library-changed"): void;
}>();

const SKELETONS = 6;

// releases whose add-to-library request is still running
const pendingUris = ref(new Set<string>());

const tilesPerView = computed(() => shelfTilesPerView(props.size));

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);

const showAddPill = function (item: Album | ItemMapping): boolean {
  return props.showLibraryState && !isInLibrary(item) && itemIsAvailable(item);
};

const subtitle = function (item: Album | ItemMapping): string {
  const parts: string[] = [];
  if ("album_type" in item && item.album_type !== AlbumType.UNKNOWN) {
    parts.push($t(`album_type.${item.album_type}`));
  }
  if (item.year) parts.push(String(item.year));
  if (props.showLibraryState && !isInLibrary(item)) {
    parts.push($t("not_in_library"));
  }
  return parts.join(" · ");
};

const addToLibrary = async function (item: Album | ItemMapping) {
  pendingUris.value.add(item.uri);
  try {
    await api.addItemToLibrary(item);
    toast.success($t("added_to_library", [item.name]));
    emit("library-changed");
  } catch (err) {
    console.error("[ArtistReleaseShelf] add to library failed", err);
  } finally {
    pendingUris.value.delete(item.uri);
  }
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
.artist-shelf__add:disabled {
  cursor: default;
  opacity: 0.6;
}
.artist-shelf__add {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 7px;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

@media (max-width: 768px) {
  .artist-shelf__title {
    font-size: 19px;
  }
}
</style>
