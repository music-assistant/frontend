<script setup lang="ts">
import { computed, markRaw } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useShortcuts, type ShortcutItem } from "@/composables/useShortcuts";
import { showContextMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import { getImageThumbForItem } from "@/helpers/utils";
import { eventbus } from "@/plugins/eventbus";
import { MediaType } from "@/plugins/api/interfaces";

const RouterLinkComponent = markRaw(RouterLink);
const route = useRoute();
const { t } = useI18n();
const { isMobile, setOpenMobile, state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");

const { pinnedItems } = useShortcuts();

const isActive = (url: string) =>
  route.path === url || route.path.startsWith(url + "/");

const handleClick = () => {
  if (isMobile.value) setOpenMobile(false);
};

const handleAddShortcut = () => {
  eventbus.emit("addShortcut");
  if (isMobile.value) setOpenMobile(false);
};

const MEDIA_TYPE_PATH: Partial<Record<MediaType, string>> = {
  [MediaType.PLAYLIST]: "playlists",
  [MediaType.ARTIST]: "artists",
  [MediaType.ALBUM]: "albums",
  [MediaType.TRACK]: "tracks",
  [MediaType.RADIO]: "radios",
};

const MEDIA_TYPE_FALLBACK_ICON: Partial<Record<MediaType, string>> = {
  [MediaType.PLAYLIST]: "mdi-playlist-music",
  [MediaType.ARTIST]: "mdi-account-music",
  [MediaType.ALBUM]: "mdi-album",
  [MediaType.TRACK]: "mdi-music-note",
  [MediaType.RADIO]: "mdi-radio-tower",
};

const getItemUrl = (item: ShortcutItem) => {
  const base = MEDIA_TYPE_PATH[item.media_type] ?? "playlists";
  return `/${base}/${item.provider}/${item.item_id}`;
};

const getFallbackIcon = (item: ShortcutItem) =>
  MEDIA_TYPE_FALLBACK_ICON[item.media_type] ?? "mdi-music-note";

const openContextMenu = async (event: MouseEvent, item: ShortcutItem) => {
  await showContextMenuForMediaItem(
    item,
    undefined,
    event.clientX,
    event.clientY,
  );
};
</script>

<template>
  <template v-if="pinnedItems.length > 0 || !isCollapsed">
    <div
      :class="[
        'my-1',
        'h-px',
        'shrink-0',
        'bg-sidebar-border',
        isCollapsed ? 'mx-1' : 'mx-3',
      ]"
    ></div>
    <SidebarGroup :class="{ 'shortcuts-group-collapsed': isCollapsed }">
      <SidebarGroupContent class="flex flex-col gap-0.5">
        <SidebarMenu>
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
            >
              <img
                v-if="getImageThumbForItem(item)"
                :src="getImageThumbForItem(item, undefined, 64)"
                :class="[
                  'shortcut-thumb',
                  isCollapsed ? 'shortcut-thumb--collapsed' : '',
                ]"
                :alt="item.name"
              />
              <v-icon
                v-else
                :icon="getFallbackIcon(item)"
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
            <v-btn
              v-if="!isCollapsed"
              icon="mdi-dots-vertical"
              variant="plain"
              density="compact"
              class="shortcut-action-btn opacity-0 group-hover/menu-item:opacity-100 absolute right-1 top-1/2 -translate-y-1/2"
              :title="t('more_options')"
              @click.stop="openContextMenu($event, item)"
            />
          </SidebarMenuItem>

          <!-- Add shortcut button -->
          <SidebarMenuItem class="mr-1.5">
            <SidebarMenuButton
              as="button"
              :tooltip="t('add_shortcut')"
              class="no-underline font-medium text-sm"
              @click="handleAddShortcut"
            >
              <v-icon
                icon="mdi-plus-circle-outline"
                size="19"
                class="shortcut-add-icon"
              />
              <span v-if="!isCollapsed">{{ t("add_shortcut") }}</span>
            </SidebarMenuButton>
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

/* MDI plus icon — match NavMain size */
:deep([data-sidebar="menu-button"] .shortcut-add-icon) {
  font-size: 1.2rem !important;
  flex-shrink: 0;
  margin-right: 0.3rem !important;
  padding-right: 3px !important;
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
