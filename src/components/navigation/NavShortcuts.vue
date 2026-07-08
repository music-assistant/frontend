<script setup lang="ts">
import type { LucideIcon } from "@lucide/vue";
import {
  BookAudio,
  Disc3,
  EllipsisVertical,
  ListMusic,
  Mic2,
  Music,
  Podcast,
  Radio,
  Tag,
} from "@lucide/vue";
import { computed, markRaw } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, useRoute } from "vue-router";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  getEventPosition,
  useHoldToOpenMenu,
} from "@/composables/useHoldToOpenMenu";
import { useShortcuts, type ShortcutItem } from "@/composables/useShortcuts";
import { useShortcutDragReorder } from "@/composables/useShortcutDragReorder";
import { ref } from "vue";
import { useSidebarScrollbarGutter } from "@/composables/useSidebarScrollbarGutter";
import { getImageThumbForItem } from "@/helpers/utils";
import { showContextMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import { MediaType } from "@/plugins/api/interfaces";

const RouterLinkComponent = markRaw(RouterLink);
const route = useRoute();
const { t } = useI18n();
const { isMobile, setOpenMobile, state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");

const { pinnedItems, isLoading, pinnedCount } = useShortcuts();

const isActive = (url: string) =>
  route.path === url || route.path.startsWith(url + "/");

const handleClick = () => {
  if (isMobile.value) setOpenMobile(false);
};

const MEDIA_TYPE_PATH: Partial<Record<MediaType, string>> = {
  [MediaType.PLAYLIST]: "playlists",
  [MediaType.ARTIST]: "artists",
  [MediaType.ALBUM]: "albums",
  [MediaType.TRACK]: "tracks",
  [MediaType.RADIO]: "radios",
  [MediaType.PODCAST]: "podcasts",
  [MediaType.AUDIOBOOK]: "audiobooks",
  [MediaType.GENRE]: "genres",
};

const MEDIA_TYPE_FALLBACK_ICON: Partial<Record<MediaType, LucideIcon>> = {
  [MediaType.PLAYLIST]: ListMusic,
  [MediaType.ARTIST]: Mic2,
  [MediaType.ALBUM]: Disc3,
  [MediaType.TRACK]: Music,
  [MediaType.RADIO]: Radio,
  [MediaType.PODCAST]: Podcast,
  [MediaType.AUDIOBOOK]: BookAudio,
  [MediaType.GENRE]: Tag,
};

const getItemUrl = (item: ShortcutItem) => {
  const base = MEDIA_TYPE_PATH[item.media_type] ?? "playlists";
  const provider = encodeURIComponent(item.provider);
  const itemId = encodeURIComponent(item.item_id);
  return `/${base}/${provider}/${itemId}`;
};

const getFallbackIcon = (item: ShortcutItem): LucideIcon =>
  MEDIA_TYPE_FALLBACK_ICON[item.media_type] ?? Music;

const getDisplayName = (item: ShortcutItem): string =>
  item.media_type === MediaType.GENRE && item.name
    ? item.name.charAt(0).toUpperCase() + item.name.slice(1)
    : item.name;

const thumbMap = computed(() =>
  Object.fromEntries(
    pinnedItems.value.map((item) => [
      item.uri,
      getImageThumbForItem(item, undefined, 64),
    ]),
  ),
);

const pinnedItemsWithUrls = computed(() =>
  pinnedItems.value.map((item) => ({ item, url: getItemUrl(item) })),
);

const openContextMenu = async (event: Event, item: ShortcutItem) => {
  const pos = getEventPosition(event);
  await showContextMenuForMediaItem(
    item,
    undefined,
    pos.x,
    pos.y,
    true,
    true,
    undefined,
    { shortcutContext: true },
  );
};

const { onHold, onTouchStart, swallowClickAfterHold } =
  useHoldToOpenMenu(openContextMenu);

const { navEl } = useSidebarScrollbarGutter(pinnedItems);

// Drag&drop reordering
const shortcutsScrollEl = ref<HTMLElement | null>(null);
const {
  startItemDrag,
  draggingIndex,
  isDragging,
  draggedItem,
  ghostY,
  rowOffset,
} = useShortcutDragReorder({
  scrollEl: shortcutsScrollEl,
  itemAt: (index: number) => pinnedItems.value[index],
  totalCount: () => pinnedItems.value.length,
});
</script>

<template>
  <div ref="navEl"></div>
  <template v-if="pinnedItems.length > 0 || isLoading">
    <SidebarGroup :class="{ 'shortcuts-group-collapsed': isCollapsed }">
      <SidebarGroupLabel>{{ t("shortcuts") }}</SidebarGroupLabel>
      <SidebarGroupContent
        ref="shortcutsScrollEl"
        class="flex flex-col gap-0.5"
        style="position: relative"
      >
        <SidebarMenu>
          <!-- Skeletons while the API calls are in flight -->
          <template v-if="isLoading">
            <SidebarMenuItem v-for="i in pinnedCount" :key="`skeleton-${i}`">
              <SidebarMenuSkeleton :show-icon="true" />
            </SidebarMenuItem>
          </template>
          <!-- Pinned shortcuts -->
          <SidebarMenuItem
            v-for="({ item, url }, index) in pinnedItemsWithUrls"
            :key="item.uri"
            v-hold="(e: Event) => onHold(e, item)"
            :data-shortcut-index="index"
            :class="[
              'mr-1.5',
              'shortcut-item',
              { 'shortcut-dragging': draggingIndex === index },
            ]"
            :style="{
              transform: `translateY(${rowOffset(index)}px)`,
              transition:
                isDragging && draggingIndex !== index
                  ? 'transform 200ms ease-out'
                  : 'none',
            }"
            @click.capture="swallowClickAfterHold"
            @touchstart.passive="onTouchStart"
            @pointerdown="!isCollapsed && startItemDrag($event, index)"
          >
            <SidebarMenuButton
              :as="RouterLinkComponent"
              :to="url"
              :is-active="isActive(url)"
              :tooltip="getDisplayName(item)"
              :class="[
                isCollapsed ? 'shortcut-button-collapsed' : 'shortcut-button',
                isActive(url)
                  ? 'no-underline font-bold'
                  : 'no-underline font-medium',
              ]"
              @click="handleClick"
              @contextmenu.prevent="openContextMenu($event, item)"
            >
              <img
                v-if="thumbMap[item.uri]"
                :src="thumbMap[item.uri]"
                :class="[
                  'shortcut-thumb',
                  isCollapsed ? 'shortcut-thumb--collapsed' : '',
                ]"
                :alt="getDisplayName(item)"
              />
              <component
                :is="getFallbackIcon(item)"
                v-else
                :class="[
                  'shortcut-thumb',
                  isCollapsed ? 'shortcut-thumb--collapsed' : '',
                ]"
              />
              <span v-if="!isCollapsed" class="shortcut-label">
                <span class="shortcut-name">{{ getDisplayName(item) }}</span>
                <span class="shortcut-type">{{ t(item.media_type) }}</span>
              </span>
            </SidebarMenuButton>
            <Button
              v-if="!isCollapsed"
              variant="ghost"
              size="icon"
              class="shortcut-action-btn opacity-0 group-hover/menu-item:opacity-100 absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              :title="t('more_options')"
              @click.stop="openContextMenu($event, item)"
            >
              <EllipsisVertical class="h-4 w-4" />
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <!-- Drag ghost -->
        <div
          v-if="isDragging && draggedItem"
          class="shortcut-drag-ghost"
          :style="{
            top: `${ghostY}px`,
            width: '100%',
          }"
        >
          <div class="shortcut-ghost-content">
            <img
              v-if="thumbMap[draggedItem.uri]"
              :src="thumbMap[draggedItem.uri]"
              class="shortcut-thumb"
              :alt="getDisplayName(draggedItem)"
            />
            <component
              :is="getFallbackIcon(draggedItem)"
              v-else
              class="shortcut-thumb"
            />
            <span class="shortcut-label">
              <span class="shortcut-name">{{
                getDisplayName(draggedItem)
              }}</span>
              <span class="shortcut-type">{{ t(draggedItem.media_type) }}</span>
            </span>
          </div>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  </template>
</template>

<style scoped>
:deep(.shortcuts-group-collapsed[data-sidebar="group"]) {
  padding-left: 0 !important;
  padding-right: 0 !important;
  align-items: start !important;
}

:deep(a) {
  text-decoration: none !important;
  color: inherit !important;
}

:deep(a:visited) {
  color: inherit !important;
}

/* Override AppSidebar global padding for image-based items */
:deep([data-sidebar="menu-button"].shortcut-button) {
  /* explicit height (not auto) so transition-[height] can animate */
  height: 3rem !important;
  padding: 0.3rem 2.25rem 0.3rem 0.5rem !important;
  align-items: center !important;
}

/* padding 0.125rem makes content area exactly 1.75rem = icon width → centered */
:deep([data-sidebar="menu-button"].shortcut-button-collapsed) {
  padding: 0.125rem !important;
  align-items: center !important;
}

.shortcut-thumb {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  margin-right: 0.5rem;
  transition:
    width 400ms ease-linear,
    height 400ms ease-linear,
    margin-right 400ms ease-linear;
}

.shortcut-thumb--collapsed {
  width: 1.75rem;
  height: 1.75rem;
  margin-right: 0;
}

/* The fallback icon renders as a direct-child <svg>, which AppSidebar's global
   `[data-sidebar="menu-button"] > svg { width: 1.6rem !important }` rule (meant
   for nav icons) shrinks — making icon-only shortcuts indent their label
   differently from image ones. Match the image thumb size. `!important` plus
   the extra .shortcut-thumb class (higher specificity) is required to beat that
   global rule across its height breakpoints. */
:deep([data-sidebar="menu-button"] > svg.shortcut-thumb) {
  width: 2rem !important;
  height: 2rem !important;
  margin-left: 0.25rem !important;
  margin-right: 0.75rem !important;
}
:deep([data-sidebar="menu-button"] > svg.shortcut-thumb--collapsed) {
  width: 1.75rem !important;
  height: 1.75rem !important;
  margin-right: 0 !important;
}

.shortcut-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.shortcut-name {
  /* match sidebar menu item label: Tailwind `text-sm font-medium` */
  font-size: 0.875rem;
  line-height: 1.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-type {
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1.3;
  opacity: var(
    --v-list-item-subtitle-opacity,
    var(--v-medium-emphasis-opacity)
  );
  /* Match list subtitles (e.g., artist/album in item list) */
  color: rgb(var(--v-theme-on-panel), 0.6);
}

/* mdi-dots-vertical v-btn — ensure it appears above the RouterLink */
:deep(.shortcut-action-btn) {
  z-index: 1;
}

/* Clip the absolute-positioned action btn without forcing overflow-y to auto.
   `overflow-x: hidden` would silently flip overflow-y to auto and create a
   spurious vertical scrollbar inside the sidebar; `clip` is the only value
   that does not trigger that side-effect. */
:deep([data-sidebar="group-content"]) {
  overflow-x: clip;
}

/* Drag&drop styling */
.shortcut-item {
  position: relative;
  user-select: none;
  touch-action: none;
}

.shortcut-dragging {
  opacity: 0.4;
}

.shortcut-drag-ghost {
  position: absolute;
  left: 0;
  pointer-events: none;
  z-index: 1000;
  opacity: 0.95;
}

.shortcut-ghost-content {
  display: flex;
  align-items: center;
  height: 3rem;
  padding: 0.3rem 2.25rem 0.3rem 0.5rem;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
