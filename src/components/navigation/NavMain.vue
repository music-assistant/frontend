<script setup lang="ts">
import { computed, markRaw, ref, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, useRoute, useRouter } from "vue-router";

const RouterLinkComponent = markRaw(RouterLink);

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useListDragReorder } from "@/composables/useListDragReorder";
import { Eye, EyeOff, GripVertical } from "@lucide/vue";
import NavSectionHeader from "./NavSectionHeader.vue";
import {
  setMenuItemHidden,
  setMenuItemsOrder,
  type MenuSectionId,
} from "./utils/getMenuItems";

interface NavItem {
  id?: string;
  title: string;
  url: string;
  icon?: Component;
  disabled?: boolean;
  hidden?: boolean;
  openInNewTab?: boolean;
}

const props = defineProps<{
  items: NavItem[];
  label?: string;
  // Translated default section label (to detect when a rename is a no-op).
  defaultLabel?: string;
  labelHidden?: boolean;
  sectionId?: MenuSectionId;
  editMode?: boolean;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isMobile, setOpenMobile } = useSidebar();

const isActive = (url: string) =>
  route.path === url || route.path.startsWith(url + "/");

const handleClick = (item: NavItem, event: Event) => {
  if (item.openInNewTab) {
    event.preventDefault();
    const resolved = router.resolve(item.url).href;
    const fullUrl = new URL(resolved, window.location.href).href;
    window.open(fullUrl, "_blank");
  }
  if (isMobile.value) {
    setOpenMobile(false);
  }
};

// ---- edit mode: hide/show items --------------------------------------------

const toggleItemHidden = (item: NavItem) => {
  if (!item.id) return;
  setMenuItemHidden(item.id, !item.hidden);
};

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
  count: () => props.items.length,
  onCommit: (from, to) => {
    const ids = props.items
      .map((item) => item.id)
      .filter((id): id is string => !!id);
    if (ids.length !== props.items.length) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    setMenuItemsOrder(ids);
  },
});

const draggedItem = computed(() =>
  draggingIndex.value != null ? props.items[draggingIndex.value] : null,
);
</script>

<template>
  <SidebarGroup v-if="items.length > 0">
    <!-- Section header: inline rename + label visibility toggle in edit mode -->
    <NavSectionHeader
      v-if="sectionId"
      :section-id="sectionId"
      :label="label ?? ''"
      :default-label="defaultLabel ?? label ?? ''"
      :label-hidden="labelHidden"
      :edit-mode="editMode"
    />
    <SidebarGroupLabel v-else-if="label">{{ label }}</SidebarGroupLabel>

    <SidebarGroupContent class="flex flex-col gap-0.5">
      <!-- Edit mode: static rows with drag handle + visibility toggle -->
      <div v-if="editMode" ref="listEl" class="relative">
        <SidebarMenu>
          <SidebarMenuItem
            v-for="(item, index) in items"
            :key="item.id ?? item.title"
            :data-drag-index="index"
            class="mr-1.5 nav-edit-row"
            :class="{ 'nav-edit-row-dragging': draggingIndex === index }"
            :style="{
              transform: `translateY(${rowOffset(index)}px)`,
              transition:
                isDragging && draggingIndex !== index
                  ? 'transform 200ms ease-out'
                  : 'none',
            }"
          >
            <div
              class="nav-edit-row-inner"
              :class="{ 'nav-edit-row-off': item.hidden }"
            >
              <button
                class="nav-edit-drag-handle"
                :aria-label="t('queue_reorder')"
                @pointerdown.stop.prevent="startItemDrag($event, index)"
                @click.stop
              >
                <GripVertical class="size-4" />
              </button>
              <component
                :is="item.icon"
                v-if="item.icon"
                class="nav-edit-row-icon"
              />
              <span class="nav-edit-row-title">{{ item.title }}</span>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 shrink-0"
                :title="t(item.hidden ? 'menu_item_show' : 'menu_item_hide')"
                @click.stop="toggleItemHidden(item)"
              >
                <Eye v-if="!item.hidden" class="size-4" />
                <EyeOff v-else class="size-4" />
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <!-- Floating ghost that follows the pointer while dragging -->
        <div
          v-if="isDragging && draggedItem"
          class="nav-edit-ghost bg-sidebar-accent text-sidebar-accent-foreground"
          :style="{ top: `${ghostY}px`, height: `${dragRowHeight}px` }"
        >
          <GripVertical class="size-4 opacity-60" />
          <component
            :is="draggedItem.icon"
            v-if="draggedItem.icon"
            class="nav-edit-row-icon"
          />
          <span class="nav-edit-row-title">{{ draggedItem.title }}</span>
        </div>
      </div>

      <!-- Normal mode: navigation links -->
      <SidebarMenu v-else>
        <SidebarMenuItem v-for="item in items" :key="item.title" class="mr-1.5">
          <SidebarMenuButton
            :as="
              item.disabled || item.openInNewTab
                ? 'button'
                : RouterLinkComponent
            "
            v-bind="item.disabled || item.openInNewTab ? {} : { to: item.url }"
            :is-active="isActive(item.url)"
            :tooltip="item.title"
            :disabled="item.disabled"
            :class="[
              isActive(item.url)
                ? 'no-underline font-bold text-sm'
                : 'no-underline font-medium text-sm',
              item.disabled ? 'opacity-50 cursor-not-allowed' : '',
            ]"
            @click="(e: Event) => handleClick(item, e)"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              class="mr-1"
              :stroke-width="isActive(item.url) ? 2.5 : 2"
            />
            <span>{{ item.title }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>

<style scoped>
:deep(a) {
  text-decoration: none !important;
  color: inherit !important;
}

:deep(a:hover) {
  text-decoration: none !important;
}

:deep(a:visited) {
  color: inherit !important;
}

:deep([data-sidebar="menu-button"] > svg),
:deep([data-sidebar="menu-button"] svg),
:deep([data-sidebar="menu-button"] [class*="lucide"]) {
  width: 1.2rem !important;
  height: 1.2rem !important;
  padding-right: 3px !important;
}

:deep([data-sidebar="menu-item"]) {
  display: flex !important;
  flex-direction: column !important;
}

/* ---- edit mode ---- */

.nav-edit-row {
  position: relative;
  user-select: none;
}

.nav-edit-row-dragging {
  opacity: 0.35;
}

.nav-edit-row-inner {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2rem;
  margin-left: 0.5rem;
  padding: 0.125rem 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.nav-edit-row-off {
  opacity: 0.4;
}

.nav-edit-drag-handle {
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

.nav-edit-drag-handle:active {
  cursor: grabbing;
}

.nav-edit-row-icon {
  width: 1.2rem;
  height: 1.2rem;
  flex-shrink: 0;
}

.nav-edit-row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-edit-ghost {
  position: absolute;
  left: 0.25rem;
  right: 0.375rem;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  opacity: 0.95;
  pointer-events: none;
  cursor: grabbing;
}
</style>
