<script setup lang="ts">
import { computed, markRaw, ref, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink, useRoute, useRouter } from "vue-router";

const RouterLinkComponent = markRaw(RouterLink);
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Kbd } from "@/components/ui/kbd";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useListDragReorder } from "@/composables/useListDragReorder";
import { ChevronRight, Eye, EyeOff, GripVertical } from "@lucide/vue";
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
  action?: () => void;
  shortcut?: string;
}

const props = defineProps<{
  items: NavItem[];
  label?: string;
  // Translated default section label (to detect when a rename is a no-op).
  defaultLabel?: string;
  labelHidden?: boolean;
  sectionId?: MenuSectionId;
  editMode?: boolean;
  separator?: "always" | "collapsed";
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isMobile, setOpenMobile, state } = useSidebar();
const isCollapsed = computed(() => state.value === "collapsed");
const open = ref(true);
const groupOpen = computed({
  get: () =>
    isCollapsed.value ||
    !!props.editMode ||
    !props.label ||
    !!props.labelHidden ||
    open.value,
  set: (value) => {
    open.value = value;
  },
});
const isActive = (url: string) => {
  if (url.includes("?")) {
    return route.fullPath === url;
  }

  return route.path === url || route.path.startsWith(url + "/");
};

const itemActive = (item: NavItem) => !item.action && isActive(item.url);

const handleClick = (item: NavItem, event: Event) => {
  if (item.action) {
    event.preventDefault();
    item.action();
  }
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
  <SidebarGroup
    v-if="items.length > 0"
    class="[&_a]:text-inherit! [&_a]:no-underline! [&_a:hover]:no-underline! [&_a:visited]:text-inherit! [&_[data-sidebar=menu-item]]:flex! [&_[data-sidebar=menu-item]]:flex-col! px-3 py-0"
  >
    <div
      v-if="props.separator"
      class="-mx-3 px-4"
      :class="
        props.separator === 'collapsed'
          ? 'hidden group-data-[collapsible=icon]:block'
          : ''
      "
    >
      <Separator class="my-3" />
    </div>
    <Collapsible v-model:open="groupOpen" class="group/collapsible">
      <!-- Section header: inline rename + label visibility toggle in edit mode -->
      <NavSectionHeader
        v-if="sectionId && editMode"
        :section-id="sectionId"
        :label="label ?? ''"
        :default-label="defaultLabel ?? label ?? ''"
        :label-hidden="labelHidden"
        :edit-mode="editMode"
      />
      <CollapsibleTrigger
        v-else-if="label && !labelHidden"
        class="group/heading flex w-full cursor-pointer items-center border-0 bg-transparent text-left text-inherit transition-colors duration-150 ease-out hover:text-sidebar-foreground"
        :aria-label="`${label} collapse toggle`"
      >
        <SidebarGroupLabel
          as="span"
          class="group-hover/heading:text-sidebar-foreground group-hover/heading:font-semibold inline-flex min-w-0 items-center gap-1 text-sm h-10 mb-1 transition-[color,font-weight] duration-150"
        >
          {{ label }}
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
      <SidebarGroupLabel v-else-if="label && editMode">
        {{ label }}
      </SidebarGroupLabel>

      <CollapsibleContent as-child>
        <SidebarGroupContent class="flex flex-col gap-0.5">
          <!-- Edit mode: static rows with drag handle + visibility toggle -->
          <div v-if="editMode" ref="listEl" class="relative">
            <SidebarMenu>
              <SidebarMenuItem
                v-for="(item, index) in items"
                :key="item.id ?? item.title"
                :data-drag-index="index"
                class="relative mr-1.5 select-none"
                :class="{ 'opacity-35': draggingIndex === index }"
                :style="{
                  transform: `translateY(${rowOffset(index)}px)`,
                  transition:
                    isDragging && draggingIndex !== index
                      ? 'transform 200ms ease-out'
                      : 'none',
                }"
              >
                <div
                  class="flex min-h-10 items-center gap-1 text-sm font-medium"
                >
                  <button
                    class="inline-flex size-7 shrink-0 touch-none cursor-grab items-center justify-center border-0 bg-transparent text-inherit opacity-60 active:cursor-grabbing"
                    :aria-label="t('queue_reorder')"
                    @pointerdown.stop.prevent="startItemDrag($event, index)"
                    @click.stop
                  >
                    <GripVertical class="size-4" />
                  </button>
                  <div
                    class="nav-edit-item flex min-w-0 flex-1 items-center gap-2 rounded-md border border-dashed border-sidebar-border px-2 py-1.5"
                    :class="{ 'opacity-40': item.hidden }"
                  >
                    <component
                      :is="item.icon"
                      v-if="item.icon"
                      class="size-[18px] shrink-0"
                    />
                    <span class="min-w-0 flex-1 truncate">{{
                      item.title
                    }}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 shrink-0"
                    :title="
                      t(item.hidden ? 'menu_item_show' : 'menu_item_hide')
                    "
                    :aria-label="
                      t(item.hidden ? 'menu_item_show' : 'menu_item_hide')
                    "
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
              class="bg-sidebar-accent text-sidebar-accent-foreground pointer-events-none absolute right-1.5 left-1 z-50 flex cursor-grabbing items-center gap-1.5 rounded-lg px-2 py-0.5 text-sm font-medium opacity-95 shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
              :style="{ top: `${ghostY}px`, height: `${dragRowHeight}px` }"
            >
              <GripVertical class="size-4 opacity-60" />
              <component
                :is="draggedItem.icon"
                v-if="draggedItem.icon"
                class="size-[18px] shrink-0"
              />
              <span class="min-w-0 flex-1 truncate">{{
                draggedItem.title
              }}</span>
            </div>
          </div>

          <!-- Normal mode: navigation links -->
          <SidebarMenu v-else>
            <SidebarMenuItem v-for="item in items" :key="item.title">
              <SidebarMenuButton
                :as="
                  item.disabled || item.openInNewTab || item.action
                    ? 'button'
                    : RouterLinkComponent
                "
                v-bind="
                  item.disabled || item.openInNewTab || item.action
                    ? {}
                    : { to: item.url }
                "
                :is-active="itemActive(item)"
                :tooltip="item.title"
                :aria-label="item.title"
                :disabled="item.disabled"
                class="mr-1.5 group-data-[collapsible=icon]:mr-0"
                :class="[
                  'gap-4',
                  itemActive(item)
                    ? 'no-underline font-bold text-sm'
                    : 'no-underline font-medium text-sm',
                  item.disabled ? 'opacity-50 cursor-not-allowed' : '',
                ]"
                @click="(e: Event) => handleClick(item, e)"
              >
                <div class="h-6 w-6 shrink-0 flex items-center justify-center">
                  <component
                    :is="item.icon"
                    v-if="item.icon"
                    class="size-[18px] gap-3"
                    :stroke-width="itemActive(item) ? 2.5 : 2"
                  />
                </div>
                <span class="min-w-0 truncate">{{ item.title }}</span>
                <Kbd
                  v-if="item.shortcut"
                  class="ml-auto shrink-0 opacity-60 group-data-[collapsible=icon]:hidden"
                >
                  {{ item.shortcut }}
                </Kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </CollapsibleContent>
    </Collapsible>
  </SidebarGroup>
</template>
