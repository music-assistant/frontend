<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
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
import type { LucideIcon } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useShortcuts, type ShortcutItem } from "@/composables/useShortcuts";
import { showContextMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import { getImageThumbForItem } from "@/helpers/utils";
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

// Scrollbar gutter logic: when the collapsed sidebar overflows vertically,
// widen --sidebar-width-icon by 6px so the scrollbar doesn't clip thumbnails.
const navEl = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let rafId: number | null = null;

const debouncedUpdate = () => {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    updateScrollbarWidth();
  });
};

const updateScrollbarWidth = () => {
  const contentEl = navEl.value?.closest<HTMLElement>(
    "[data-slot=sidebar-content]",
  );
  const sidebarEl = navEl.value?.closest<HTMLElement>("[data-slot=sidebar]");
  if (!contentEl || !sidebarEl) return;

  const overflows =
    state.value === "collapsed" &&
    contentEl.scrollHeight > contentEl.clientHeight;

  if (overflows) {
    // Read the base value only when no override is set yet, so we don't
    // accumulate additions on repeated calls.
    if (!sidebarEl.style.getPropertyValue("--sidebar-width-icon")) {
      const base =
        getComputedStyle(sidebarEl)
          .getPropertyValue("--sidebar-width-icon")
          .trim() || "3rem";
      sidebarEl.style.setProperty(
        "--sidebar-width-icon",
        `calc(${base} + 6px)`,
      );
    }
    contentEl.style.scrollbarGutter = "stable";
  } else {
    sidebarEl.style.removeProperty("--sidebar-width-icon");
    contentEl.style.scrollbarGutter = "";
  }
};

watch(state, updateScrollbarWidth);

onMounted(() => {
  const contentEl = navEl.value?.closest<HTMLElement>(
    "[data-slot=sidebar-content]",
  );
  updateScrollbarWidth();
  if (contentEl) {
    resizeObserver = new ResizeObserver(updateScrollbarWidth);
    resizeObserver.observe(contentEl);
    mutationObserver = new MutationObserver(debouncedUpdate);
    mutationObserver.observe(contentEl, { childList: true, subtree: true });
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
  if (rafId !== null) cancelAnimationFrame(rafId);
});
</script>

<template>
  <template v-if="pinnedItems.length > 0 || isLoading">
    <div ref="navEl"></div>
    <div
      class="my-1 h-px shrink-0 bg-sidebar-border"
      :class="isCollapsed ? 'mx-1' : 'mx-3'"
    ></div>
    <SidebarGroup :class="{ 'shortcuts-group-collapsed': isCollapsed }">
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
            v-for="item in pinnedItems"
            :key="item.uri"
            class="mr-1.5"
          >
            <SidebarMenuButton
              :as="RouterLinkComponent"
              :to="getItemUrl(item)"
              :is-active="isActive(getItemUrl(item))"
              :tooltip="item.name"
              :class="[
                isCollapsed ? 'shortcut-button-collapsed' : 'shortcut-button',
                isActive(getItemUrl(item))
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
      </SidebarGroupContent>
    </SidebarGroup>
  </template>
</template>

<style scoped>
:deep(.shortcuts-group-collapsed[data-sidebar="group"]) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

:deep(a) {
  text-decoration: none !important;
  color: inherit !important;
}

:deep(a:visited) {
  color: inherit !important;
}

/* Override AppSidebar global padding for image-based items (expanded) */
:deep([data-sidebar="menu-button"].shortcut-button) {
  height: auto !important;
  min-height: unset !important;
  /* right padding reserves space for the action button so text never overlaps */
  padding: 0.3rem 2.25rem 0.3rem 0.5rem !important;
  align-items: center !important;
}

/* Collapsed: let shadcn control the 2rem×2rem size, just remove excess padding */
:deep([data-sidebar="menu-button"].shortcut-button-collapsed) {
  padding: 0.125rem !important;
  justify-content: center !important;
  align-items: center !important;
}

.shortcut-thumb {
  width: 3rem;
  height: 3rem;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  margin-right: 0.5rem;
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
  font-size: 0.875rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-type {
  font-size: 0.7rem;
  font-weight: 300;
  opacity: 0.55;
  line-height: 1.3;
}

/* mdi-dots-vertical v-btn — ensure it appears above the RouterLink */
:deep(.shortcut-action-btn) {
  z-index: 1;
}

/* prevent horizontal scrollbar from absolute-positioned action btn */
:deep([data-sidebar="group-content"]) {
  overflow-x: hidden;
}
</style>
