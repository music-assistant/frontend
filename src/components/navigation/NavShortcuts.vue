<script setup lang="ts">
import type { LucideIcon } from "@lucide/vue";
import {
  BookAudio,
  ChevronRight,
  Disc3,
  EllipsisVertical,
  Eye,
  EyeOff,
  GripVertical,
  ListMusic,
  Mic2,
  Music,
  Podcast,
  Radio,
  Tag,
} from "@lucide/vue";
import { computed, markRaw, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, useRoute } from "vue-router";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useListDragReorder } from "@/composables/useListDragReorder";
import {
  getShortcutUri,
  reorderShortcutStandalone,
  useShortcuts,
  type ShortcutItem,
} from "@/composables/useShortcuts";
import { useSidebarScrollbarGutter } from "@/composables/useSidebarScrollbarGutter";
import { getImageThumbForItem } from "@/helpers/utils";
import { showContextMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import { MediaType } from "@/plugins/api/interfaces";
import NavSectionHeader from "./NavSectionHeader.vue";
import { getMenuSectionConfig } from "./utils/getMenuItems";

const props = defineProps<{
  editMode?: boolean;
}>();

const RouterLinkComponent = markRaw(RouterLink);
const route = useRoute();
const { t } = useI18n();
const { isMobile, setOpenMobile, state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");
const open = ref(true);

const {
  pinnedItems,
  isLoading,
  pinnedCount,
  visiblePinnedItems,
  isShortcutHidden,
  toggleShortcutHidden,
} = useShortcuts();

const displayedPinnedItems = computed(() =>
  props.editMode ? pinnedItems.value : visiblePinnedItems.value,
);

const sectionConfig = computed(() => getMenuSectionConfig("shortcuts"));
const sectionLabel = computed(
  () => sectionConfig.value.label || t("shortcuts"),
);
const groupOpen = computed({
  get: () =>
    isCollapsed.value ||
    !!props.editMode ||
    !!sectionConfig.value.hide_label ||
    open.value,
  set: (value) => {
    open.value = value;
  },
});

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
  displayedPinnedItems.value.map((item) => ({ item, url: getItemUrl(item) })),
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

const holdToOpenMenu = useHoldToOpenMenu(openContextMenu);

// Long-press context menu conflicts with touch dragging, so gate it off
// while editing.
const onHold = (e: Event, item: ShortcutItem) => {
  if (!props.editMode) holdToOpenMenu.onHold(e, item);
};
const onTouchStart = () => {
  if (!props.editMode) holdToOpenMenu.onTouchStart();
};
const swallowClickAfterHold = holdToOpenMenu.swallowClickAfterHold;

const { navEl } = useSidebarScrollbarGutter(pinnedItems);

// ---- edit mode: drag-to-reorder --------------------------------------------

const listEl = ref<HTMLElement | null>(null);

const {
  startItemDrag,
  draggingIndex,
  isDragging,
  ghostY,
  dragRowHeight,
  rowOffset,
} = useListDragReorder({
  listEl,
  count: () => pinnedItems.value.length,
  onCommit: (from, to) => {
    const source = pinnedItems.value[from];
    const target = pinnedItems.value[to];
    if (!source || !target) return;
    reorderShortcutStandalone(getShortcutUri(source), getShortcutUri(target));
  },
});

const draggedItem = computed(() =>
  draggingIndex.value != null ? pinnedItems.value[draggingIndex.value] : null,
);
</script>

<template>
  <!-- <div ref="navEl" class="h-0"></div> -->
  <template v-if="displayedPinnedItems.length > 0 || isLoading">
    <SidebarGroup
      :class="{ 'shortcuts-group-collapsed': isCollapsed }"
      class="py-0 px-3"
    >
      <div class="-mx-3 px-4">
        <Separator class="my-3" />
      </div>
      <Collapsible v-model:open="groupOpen" class="group/collapsible">
        <NavSectionHeader
          v-if="editMode"
          section-id="shortcuts"
          :label="sectionLabel"
          :default-label="t('shortcuts')"
          :label-hidden="sectionConfig.hide_label"
          :edit-mode="editMode"
        />
        <CollapsibleTrigger
          v-else-if="!sectionConfig.hide_label"
          class="group/heading flex w-full cursor-pointer items-center border-0 bg-transparent text-left text-inherit transition-colors duration-150 ease-out hover:text-sidebar-foreground"
          :aria-label="`${sectionLabel} collapse toggle`"
        >
          <SidebarGroupLabel
            as="span"
            class="group-hover/heading:text-sidebar-foreground group-hover/heading:font-semibold inline-flex min-w-0 items-center gap-1 text-sm h-10 mb-1 transition-[color,font-weight] duration-150"
          >
            {{ sectionLabel }}
            <span
              class="text-sidebar-foreground/70 group-hover/heading:text-sidebar-foreground inline-flex size-5 items-center justify-center rounded-sm transition-colors duration-150 ease-out"
            >
              <ChevronRight
                class="size-3.5 basis-auto shrink-0 grow-0 transition-transform duration-150 ease-[ease]"
                :class="{ 'rotate-90': open }"
              />
            </span>
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent as-child>
          <SidebarGroupContent class="flex flex-col gap-0.5">
            <div ref="listEl" class="relative">
              <SidebarMenu>
                <!-- Skeletons while the API calls are in flight -->
                <template v-if="isLoading">
                  <SidebarMenuItem
                    v-for="i in pinnedCount"
                    :key="`skeleton-${i}`"
                  >
                    <SidebarMenuSkeleton :show-icon="true" />
                  </SidebarMenuItem>
                </template>
                <!-- Pinned shortcuts -->
                <SidebarMenuItem
                  v-for="({ item, url }, index) in pinnedItemsWithUrls"
                  :key="item.uri"
                  v-hold="(e: Event) => onHold(e, item)"
                  :class="{
                    'shortcut-item': editMode,
                    'shortcut-item-dragging': draggingIndex === index,
                    'shortcut-item-hidden':
                      editMode && isShortcutHidden(getShortcutUri(item)),
                  }"
                  :data-drag-index="editMode ? index : undefined"
                  :style="
                    editMode
                      ? {
                          transform: `translateY(${rowOffset(index)}px)`,
                          transition:
                            isDragging && draggingIndex !== index
                              ? 'transform 200ms ease-out'
                              : 'none',
                        }
                      : undefined
                  "
                  @click.capture="swallowClickAfterHold"
                  @touchstart.passive="onTouchStart"
                >
                  <button
                    v-if="editMode && !isCollapsed"
                    class="shortcut-drag-handle"
                    :aria-label="t('queue_reorder')"
                    @pointerdown.stop.prevent="startItemDrag($event, index)"
                    @click.stop
                  >
                    <GripVertical class="size-4" />
                  </button>
                  <SidebarMenuButton
                    :as="editMode ? 'div' : RouterLinkComponent"
                    v-bind="editMode ? {} : { to: url }"
                    :is-active="!editMode && isActive(url)"
                    :tooltip="getDisplayName(item)"
                    :aria-label="getDisplayName(item)"
                    class="mr-1.5 group-data-[collapsible=icon]:mr-0"
                    :class="[
                      'gap-4',
                      isCollapsed
                        ? 'shortcut-button-collapsed'
                        : 'shortcut-button',
                      editMode ? 'shortcut-button-editing' : '',
                      isActive(url) && !editMode
                        ? 'no-underline font-bold'
                        : 'no-underline font-medium',
                    ]"
                    @click="!editMode && handleClick()"
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
                      <span class="shortcut-name">{{
                        getDisplayName(item)
                      }}</span>
                      <span class="shortcut-type">{{
                        t(item.media_type)
                      }}</span>
                    </span>
                  </SidebarMenuButton>
                  <Button
                    v-if="editMode && !isCollapsed"
                    variant="ghost"
                    size="icon"
                    class="shortcut-visibility-btn absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    :title="
                      t(
                        isShortcutHidden(getShortcutUri(item))
                          ? 'menu_item_show'
                          : 'menu_item_hide',
                      )
                    "
                    :aria-label="
                      t(
                        isShortcutHidden(getShortcutUri(item))
                          ? 'menu_item_show'
                          : 'menu_item_hide',
                      )
                    "
                    @click.stop="toggleShortcutHidden(getShortcutUri(item))"
                  >
                    <EyeOff
                      v-if="isShortcutHidden(getShortcutUri(item))"
                      class="h-4 w-4"
                    />
                    <Eye v-else class="h-4 w-4" />
                  </Button>
                  <Button
                    v-else-if="!isCollapsed"
                    variant="ghost"
                    size="icon"
                    class="shortcut-action-btn absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    :class="
                      editMode
                        ? 'opacity-70'
                        : 'opacity-0 group-hover/menu-item:opacity-100'
                    "
                    :title="t('more_options')"
                    @click.stop="openContextMenu($event, item)"
                  >
                    <EllipsisVertical class="h-4 w-4" />
                  </Button>
                </SidebarMenuItem>
              </SidebarMenu>
              <!-- Floating ghost that follows the pointer while dragging -->
              <div
                v-if="isDragging && draggedItem"
                class="shortcut-ghost bg-sidebar-accent text-sidebar-accent-foreground"
                :style="{ top: `${ghostY}px`, height: `${dragRowHeight}px` }"
              >
                <GripVertical class="size-4 opacity-60 shrink-0" />
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
                  <span class="shortcut-type">{{
                    t(draggedItem.media_type)
                  }}</span>
                </span>
              </div>
            </div>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  </template>
</template>

<style scoped>
.shortcuts-group-heading {
  display: flex;
  align-items: center;
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.shortcuts-group-title {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

.shortcuts-group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-sm);
  color: hsl(var(--sidebar-foreground) / 0.7);
}

.shortcuts-group-heading:hover .shortcuts-group-icon {
  color: hsl(var(--sidebar-foreground));
  background: hsl(var(--sidebar-accent));
}

.shortcuts-group-chevron {
  flex: 0 0 auto;
  width: 0.875rem;
  height: 0.875rem;
  transition: transform 0.15s ease;
}

.shortcuts-group-chevron--open {
  transform: rotate(90deg);
}

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
  /* Use p-3 spacing; keep the extra right
     padding for the shortcut context-action button. */
  height: 3rem !important;
  padding: 0.75rem 2.25rem 0.75rem 0.75rem !important;
  align-items: center !important;
}

/* Make room for the drag handle on the left while editing */
:deep([data-sidebar="menu-button"].shortcut-button-editing) {
  margin-left: 1.5rem !important;
  margin-right: 1.5rem !important;
  height: 2.5rem !important;
  border: 1px dashed hsl(var(--sidebar-border)) !important;
  border-radius: 0.375rem !important;
  cursor: default;
}

/* Keep collapsed shortcut buttons aligned with the account menu button. */
:deep([data-sidebar="menu-button"].shortcut-button-collapsed) {
  padding: 3px !important;
  align-items: center !important;
}

.shortcut-thumb {
  width: 34px;
  height: 34px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  transition:
    width 400ms ease-linear,
    height 400ms ease-linear;
}

.shortcut-thumb--collapsed {
  width: 34px;
  height: 34px;
}

/* The fallback icon renders as a direct-child <svg>, which AppSidebar's global
   `[data-sidebar="menu-button"] > svg { width: 1.6rem !important }` rule (meant
   for nav icons) shrinks — making icon-only shortcuts indent their label
   differently from image ones. Match the image thumb size. `!important` plus
   the extra .shortcut-thumb class (higher specificity) is required to beat that
   global rule across its height breakpoints. */
:deep([data-sidebar="menu-button"] > svg.shortcut-thumb) {
  width: 34px !important;
  height: 34px !important;
  margin-left: 0.25rem !important;
}
:deep([data-sidebar="menu-button"] > svg.shortcut-thumb--collapsed) {
  width: 34px !important;
  height: 34px !important;
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

/* ---- edit mode ---- */

.shortcut-item {
  user-select: none;
}

.shortcut-item-dragging {
  opacity: 0.35;
}

.shortcut-item-hidden {
  opacity: 0.55;
}

.shortcut-drag-handle {
  position: absolute;
  left: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.125rem;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  cursor: grab;
  touch-action: none;
}

.shortcut-drag-handle:active {
  cursor: grabbing;
}

.shortcut-ghost {
  position: absolute;
  left: 0.25rem;
  right: 0.375rem;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  opacity: 0.95;
  pointer-events: none;
  cursor: grabbing;
}
</style>
