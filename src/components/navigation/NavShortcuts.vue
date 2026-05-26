<script setup lang="ts">
import type { LucideIcon } from "lucide-vue-next";
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
} from "lucide-vue-next";
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
import { useShortcuts, type ShortcutItem } from "@/composables/useShortcuts";
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

const openContextMenu = async (event: MouseEvent, item: ShortcutItem) => {
  await showContextMenuForMediaItem(
    item,
    undefined,
    event.clientX,
    event.clientY,
    true,
    true,
  );
};

const { navEl } = useSidebarScrollbarGutter(pinnedItems);
</script>

<template>
  <div ref="navEl"></div>
  <template v-if="pinnedItems.length > 0 || isLoading">
    <SidebarGroup :class="{ 'shortcuts-group-collapsed': isCollapsed }">
      <SidebarGroupLabel>{{ t("shortcuts") }}</SidebarGroupLabel>
      <SidebarGroupContent class="flex flex-col gap-0.5">
        <SidebarMenu>
          <!-- Skeletons while the API calls are in flight -->
          <template v-if="isLoading">
            <SidebarMenuItem v-for="i in pinnedCount" :key="`skeleton-${i}`">
              <SidebarMenuSkeleton :show-icon="true" />
            </SidebarMenuItem>
          </template>
          <!-- Pinned shortcuts -->
          <SidebarMenuItem
            v-for="{ item, url } in pinnedItemsWithUrls"
            :key="item.uri"
            class="mr-1.5"
          >
            <SidebarMenuButton
              :as="RouterLinkComponent"
              :to="url"
              :is-active="isActive(url)"
              :tooltip="item.name"
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
                :alt="item.name"
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
                <span class="shortcut-name">{{ item.name }}</span>
                <span class="shortcut-type text-muted-foreground">{{
                  t(item.media_type)
                }}</span>
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

.shortcut-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.shortcut-name {
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-type {
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.3;
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
</style>
