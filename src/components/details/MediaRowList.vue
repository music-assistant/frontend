<template>
  <section class="media-rows">
    <div class="media-rows__head">
      <div
        v-hold="onHold"
        class="media-rows__titles"
        @touchstart.passive="onTouchStart"
        @click.capture="swallowClickAfterHold"
      >
        <h2 class="media-rows__title">{{ title }}</h2>
        <span v-if="meta" class="media-rows__meta">{{ meta }}</span>
      </div>
      <RouterLink
        v-if="viewAllTo"
        :to="viewAllTo"
        class="media-rows__more"
        :aria-label="$t('tooltip.view_all', { name: title })"
      >
        {{ $t("view_all") }}
      </RouterLink>
    </div>

    <div class="media-rows__list">
      <template v-if="shownItems">
        <div
          v-for="item in shownItems"
          :key="item.uri"
          v-hold="(e: Event) => onItemHold(e, item)"
          class="media-rows__row"
          :class="{ 'media-rows__row--playing': isNowPlaying(item) }"
          role="button"
          tabindex="0"
          @click="(e: MouseEvent) => onItemClick(e, item)"
          @keydown.enter.self="(e: KeyboardEvent) => onItemClick(e, item)"
          @keydown.space.self.prevent="
            (e: KeyboardEvent) => onItemClick(e, item)
          "
          @contextmenu.prevent="(e: MouseEvent) => onItemMenu(e, item)"
          @touchstart.passive="onItemTouchStart"
        >
          <span
            class="media-rows__art"
            :class="{ 'media-rows__art--unavailable': !itemIsAvailable(item) }"
          >
            <MediaItemThumb :item="item" :size="40" />
          </span>
          <span class="media-rows__text">
            <span class="media-rows__name">
              {{ item.name }}
              <span v-if="item.version" class="media-rows__version"
                >({{ item.version }})</span
              >
            </span>
            <span class="media-rows__subtitle">
              <slot name="subtitle" :item="item">{{ subtitle(item) }}</slot>
            </span>
          </span>
          <span v-if="$slots.tag" class="media-rows__tag">
            <slot name="tag" :item="item"></slot>
          </span>
          <span v-if="itemDuration(item)" class="media-rows__duration">{{
            formatDuration(itemDuration(item)!)
          }}</span>
          <button
            v-if="showFavorite && 'favorite' in item"
            type="button"
            class="media-rows__button"
            :class="{ 'media-rows__button--favorite': item.favorite }"
            :aria-label="$t('tooltip.favorite')"
            :aria-pressed="item.favorite ? 'true' : 'false'"
            @click.stop="api.toggleFavorite(item)"
          >
            <IconHeartFilled v-if="item.favorite" :size="18" />
            <IconHeart v-else :stroke-width="2" :size="18" />
          </button>
          <button
            type="button"
            class="media-rows__button"
            :aria-label="`${$t('more_options')}: ${item.name}`"
            @click.stop="(e: MouseEvent) => onItemMenu(e, item)"
          >
            <EllipsisVertical :size="16" />
          </button>
        </div>
      </template>
      <template v-else>
        <div
          v-for="index in skeletonCount"
          :key="index"
          class="media-rows__row"
          aria-hidden="true"
        >
          <Skeleton class="media-rows__art" />
          <Skeleton class="media-rows__skeleton-text" />
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import {
  handleMediaItemClick,
  handleMenuBtnClick,
} from "@/helpers/media_item_actions";
import { formatDuration, getArtistsString } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  AlbumType,
  PlaybackState,
  type ItemMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { EllipsisVertical } from "@lucide/vue";
import { IconHeart, IconHeartFilled } from "@tabler/icons-vue";
import { computed } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

type RowItem = MediaItemType | ItemMapping;

export interface Props {
  title: string;
  // the line beside the title, e.g. "3" or "2 releases"
  meta?: string;
  // undefined while the row is still loading
  items?: RowItem[];
  // rows shown inline; the rest sit behind "View all"
  limit?: number;
  viewAllTo?: RouteLocationRaw;
  parentItem?: MediaItemType;
  // a heart button per row, for the items that can be favorites
  showFavorite?: boolean;
  skeletonCount?: number;
}
const props = withDefaults(defineProps<Props>(), {
  meta: undefined,
  items: undefined,
  limit: undefined,
  viewAllTo: undefined,
  parentItem: undefined,
  showFavorite: false,
  skeletonCount: 3,
});

defineSlots<{
  // the second line of a row; defaults to the artists, else the release info
  subtitle?: (props: { item: RowItem }) => unknown;
  // an optional pill after the text
  tag?: (props: { item: RowItem }) => unknown;
}>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const shownItems = computed(() =>
  props.limit ? props.items?.slice(0, props.limit) : props.items,
);

const { onHold, onTouchStart, swallowClickAfterHold } = useHoldToOpenMenu(() =>
  emit("edit-rows"),
);

const {
  onHold: onItemHold,
  onTouchStart: onItemTouchStart,
  swallowClickAfterHold: swallowClickAfterItemHold,
} = useHoldToOpenMenu<[RowItem]>((evt, item) => onItemMenu(evt, item));

const isNowPlaying = function (item: RowItem): boolean {
  if (store.activePlayer?.playback_state != PlaybackState.PLAYING) return false;
  const current = store.curQueueItem?.media_item;
  return (
    !!current &&
    current.media_type === item.media_type &&
    current.item_id === item.item_id
  );
};

const subtitle = function (item: RowItem): string {
  if ("artists" in item && item.artists.length) {
    return getArtistsString(item.artists);
  }
  const parts: string[] = [];
  if ("album_type" in item && item.album_type !== AlbumType.UNKNOWN) {
    parts.push($t(`album_type.${item.album_type}`));
  }
  if ("year" in item && item.year) parts.push(String(item.year));
  return parts.join(" · ");
};

const onItemClick = function (
  event: MouseEvent | KeyboardEvent,
  item: RowItem,
) {
  if (swallowClickAfterItemHold(event)) return;
  const x = "clientX" in event ? event.clientX : 0;
  const y = "clientY" in event ? event.clientY : 0;
  handleMediaItemClick(item, x, y, props.parentItem);
};

const onItemMenu = function (event: Event, item: RowItem) {
  const { x, y } = getEventPosition(event);
  handleMenuBtnClick(item, x, y, props.parentItem, true);
};

/** The item's duration in seconds, for the media types that carry one. */
function itemDuration(item: RowItem): number | undefined {
  return "duration" in item && item.duration ? item.duration : undefined;
}
</script>

<style scoped>
.media-rows {
  padding: 26px 28px 0;
}
.media-rows__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.media-rows__titles {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.media-rows__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: rgb(var(--v-theme-on-background));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.media-rows__meta {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
}
.media-rows__more {
  flex: none;
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  white-space: nowrap;
}
.media-rows__more:hover,
.media-rows__more:focus-visible {
  text-decoration: underline;
}

/* the rows' hover area extends past the text, so they line up with the title */
.media-rows__list {
  margin: 0 -8px;
}
.media-rows__row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  min-width: 0;
}
.media-rows__row + .media-rows__row {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.media-rows__row:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.media-rows__art {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 6px;
  overflow: hidden;
}
.media-rows__art--unavailable {
  opacity: 0.5;
}
.media-rows__text {
  display: block;
  flex: 1;
  min-width: 0;
}
.media-rows__name {
  display: block;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.media-rows__row--playing .media-rows__name {
  color: rgb(var(--v-theme-primary));
}
.media-rows__version {
  color: rgba(var(--v-theme-on-surface), 0.6);
}
.media-rows__subtitle {
  display: block;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.media-rows__tag {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.12);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.media-rows__duration {
  width: 44px;
  flex: none;
  text-align: right;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-variant-numeric: tabular-nums;
}
.media-rows__button {
  width: 28px;
  height: 28px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: none;
  color: rgba(var(--v-theme-on-surface), 0.6);
  cursor: pointer;
}
.media-rows__button:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.media-rows__button--favorite {
  color: rgb(var(--v-theme-primary));
}
.media-rows__skeleton-text {
  height: 16px;
  flex: 1;
}

@media (max-width: 768px) {
  .media-rows {
    padding: 20px 16px 0;
  }
  .media-rows__title {
    font-size: 19px;
  }
  .media-rows__list {
    margin: 0;
  }
  .media-rows__row {
    padding: 0;
    border-radius: 0;
  }
  .media-rows__row:hover {
    background: none;
  }
  .media-rows__name {
    font-size: 14px;
  }
  .media-rows__subtitle {
    font-size: 12px;
  }
  /* the tag, name and duration do not all fit a 390px row */
  .media-rows__row:has(.media-rows__tag) .media-rows__duration {
    display: none;
  }
}
</style>
